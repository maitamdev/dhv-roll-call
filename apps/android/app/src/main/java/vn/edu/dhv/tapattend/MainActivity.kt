package vn.edu.dhv.tapattend

import android.Manifest
import android.app.PendingIntent
import android.content.Intent
import android.content.IntentFilter
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.Build
import android.os.Bundle
import android.content.pm.PackageManager
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.Image
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import vn.edu.dhv.tapattend.data.local.AppDatabase
import vn.edu.dhv.tapattend.data.local.OfflineScanEntity
import vn.edu.dhv.tapattend.network.ApiClient
import vn.edu.dhv.tapattend.presentation.NfcScanScreen
import vn.edu.dhv.tapattend.presentation.FaceVerificationScreen
import vn.edu.dhv.tapattend.presentation.ScanUiState
import vn.edu.dhv.tapattend.sync.OfflineScanSyncWorker
import java.text.SimpleDateFormat
import java.time.Instant
import java.util.Date
import java.util.Locale
import java.util.UUID

private data class PendingFaceVerification(
    val challengeId: String,
    val action: String,
    val studentName: String,
    val studentCode: String
)

private data class ActiveSession(
    val id: String,
    val courseName: String,
    val className: String,
    val roomCode: String,
    val lecturerName: String,
    val totalCount: Int,
    val attendedCount: Int
)

class MainActivity : ComponentActivity() {

    private var nfcAdapter: NfcAdapter? = null
    private var pendingIntent: PendingIntent? = null
    private var intentFiltersArray: Array<IntentFilter>? = null
    private var techListsArray: Array<Array<String>>? = null

    // Compose States
    private var isSetupCompleteState = mutableStateOf(false)
    private var sessionIdState = mutableStateOf("")
    private var pairingCodeState = mutableStateOf("")
    private var isPairedState = mutableStateOf(false)
    private var activeSessionState = mutableStateOf<ActiveSession?>(null)
    private var roomCodeState = mutableStateOf("")
    private var pendingFaceState = mutableStateOf<PendingFaceVerification?>(null)
    private var sessionPollingJob: Job? = null
    private var scanInFlight = false
    private var lastUid = ""
    private var lastScanAtMs = 0L

    private var uiState = mutableStateOf<ScanUiState>(ScanUiState.Idle)
    private var presentCountState = mutableIntStateOf(0)
    private var totalCountState = mutableIntStateOf(0)

    private val apiClient = ApiClient()
    private val deviceId: String by lazy {
        val preferences = getSharedPreferences("tap_attend_device", MODE_PRIVATE)
        preferences.getString("device_id", null) ?: UUID.randomUUID().toString().also {
            preferences.edit().putString("device_id", it).apply()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        isPairedState.value = getSharedPreferences("tap_attend_device", MODE_PRIVATE)
            .getBoolean("paired", false)
        roomCodeState.value = getSharedPreferences("tap_attend_device", MODE_PRIVATE)
            .getString("room_code", "").orEmpty()
        if (isPairedState.value) {
            isSetupCompleteState.value = true
            startSessionPolling()
        }

        // Init NFC
        nfcAdapter = NfcAdapter.getDefaultAdapter(this)
        
        val intent = Intent(this, javaClass).apply {
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        intentFiltersArray = null
        techListsArray = arrayOf(
            arrayOf("android.nfc.tech.MifareClassic"),
            arrayOf("android.nfc.tech.IsoDep"),
            arrayOf("android.nfc.tech.NfcA")
        )

        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = Color(0xFF122B5A),
                    secondary = Color(0xFFE31837),
                    background = Color(0xFFF8FAFC)
                )
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val pendingFace = pendingFaceState.value
                    if (pendingFace != null) {
                        FaceVerificationScreen(
                            studentName = pendingFace.studentName,
                            studentCode = pendingFace.studentCode,
                            action = pendingFace.action,
                            onVerifiedFrame = { image, duration ->
                                submitFaceFrame(pendingFace, image, duration)
                            },
                            onCancel = {
                                pendingFaceState.value = null
                                uiState.value = ScanUiState.Idle
                            }
                        )
                    } else if (isSetupCompleteState.value) {
                        val activeSession = activeSessionState.value
                        NfcScanScreen(
                            courseName = activeSession?.courseName ?: "ĐANG CHỜ BUỔI HỌC",
                            className = activeSession?.className ?: "MÁY QUÉT CỐ ĐỊNH",
                            roomCode = activeSession?.roomCode?.ifBlank { roomCodeState.value } ?: roomCodeState.value.ifBlank { "CHƯA GÁN" },
                            uiState = uiState.value,
                            presentCount = presentCountState.intValue,
                            totalCount = totalCountState.intValue,
                            sessionActive = activeSession != null,
                            onResetState = { uiState.value = ScanUiState.Idle }
                        )
                    } else {
                        SetupScreen()
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (nfcAdapter != null && isSetupCompleteState.value) {
            nfcAdapter?.enableForegroundDispatch(
                this,
                pendingIntent,
                intentFiltersArray,
                techListsArray
            )
        }
    }

    override fun onPause() {
        super.onPause()
        if (nfcAdapter != null) {
            nfcAdapter?.disableForegroundDispatch(this)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (NfcAdapter.ACTION_TECH_DISCOVERED == intent.action ||
            NfcAdapter.ACTION_TAG_DISCOVERED == intent.action) {
            
            if (!isSetupCompleteState.value) {
                Toast.makeText(this, "Vui lòng thiết lập trước", Toast.LENGTH_SHORT).show()
                return
            }

            val tag: Tag? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableExtra(NfcAdapter.EXTRA_TAG, Tag::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(NfcAdapter.EXTRA_TAG)
            }
            tag?.id?.let { uidBytes ->
                val hexUid = bytesToHex(uidBytes)
                handleTagScanned(hexUid)
            }
        }
    }

    private fun startSessionPolling() {
        sessionPollingJob?.cancel()
        sessionPollingJob = lifecycleScope.launch {
            while (isActive && isPairedState.value) {
                refreshActiveSession()
                delay(10_000L)
            }
        }
    }

    private suspend fun refreshActiveSession() {
        apiClient.fetchActiveSession(BuildConfig.API_BASE_URL, deviceId)
            .onSuccess { json ->
                if (!json.optBoolean("success", false) || !json.optBoolean("active", false)) {
                    activeSessionState.value = null
                    sessionIdState.value = ""
                    presentCountState.intValue = 0
                    totalCountState.intValue = 0
                    uiState.value = ScanUiState.Waiting(
                        json.optString("message", "Chưa có phiên điểm danh đang mở tại phòng này")
                    )
                    return@onSuccess
                }
                val session = json.optJSONObject("session") ?: return@onSuccess
                val active = ActiveSession(
                    id = session.optString("id"),
                    courseName = session.optString("courseName", "Buổi học"),
                    className = session.optString("className", "Chưa xếp lớp"),
                    roomCode = session.optString("roomCode", roomCodeState.value),
                    lecturerName = session.optString("lecturerName"),
                    totalCount = session.optInt("totalCount", 0),
                    attendedCount = session.optInt("attendedCount", 0)
                )
                activeSessionState.value = active
                sessionIdState.value = active.id
                roomCodeState.value = active.roomCode
                presentCountState.intValue = active.attendedCount
                totalCountState.intValue = active.totalCount
                if (uiState.value is ScanUiState.Waiting) uiState.value = ScanUiState.Idle
            }
            .onFailure {
                activeSessionState.value = null
                sessionIdState.value = ""
                presentCountState.intValue = 0
                totalCountState.intValue = 0
                uiState.value = ScanUiState.Waiting("Đang kết nối lại với máy chủ")
            }
    }

    private fun handleTagScanned(cardUidHex: String) {
        val nowMs = System.currentTimeMillis()
        if (scanInFlight || (cardUidHex == lastUid && nowMs - lastScanAtMs < 3500L)) return
        scanInFlight = true
        lastUid = cardUidHex
        lastScanAtMs = nowMs
        val sessionId = sessionIdState.value
        if (sessionId.isBlank()) {
            scanInFlight = false
            uiState.value = ScanUiState.Waiting("Chưa có phiên điểm danh đang mở tại phòng này")
            return
        }
        val timeNow = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())

        lifecycleScope.launch {
            val result = apiClient.submitNfcScan(BuildConfig.API_BASE_URL, sessionId, cardUidHex, deviceId)
            result.onSuccess { json ->
                val student = json.optJSONObject("student")
                val attendance = json.optJSONObject("attendance")

                val name = student?.optString("fullName").orEmpty().ifBlank { "Sinh viên" }
                val code = student?.optString("studentCode").orEmpty()
                val className = student?.optString("className").orEmpty()
                val status = attendance?.optString("status") ?: "PRESENT"
                val responseCode = json.optString("code")
                val verification = json.optJSONObject("verification")

                if (responseCode == "FACE_VERIFICATION_REQUIRED" && verification != null) {
                    pendingFaceState.value = PendingFaceVerification(
                        challengeId = verification.optString("challengeId"),
                        action = verification.optString("livenessAction"),
                        studentName = name,
                        studentCode = code
                    )
                } else if (responseCode == "ALREADY_ATTENDED") {
                    uiState.value = ScanUiState.AlreadyAttended(name, timeNow)
                } else if (!json.optBoolean("success", false)) {
                    uiState.value = ScanUiState.Error(
                        json.optString("message", "Máy chủ đã từ chối lượt quét")
                    )
                } else if (status == "LATE") {
                    presentCountState.intValue += 1
                    totalCountState.intValue = maxOf(totalCountState.intValue, presentCountState.intValue)
                    uiState.value = ScanUiState.SuccessLate(name, code, className, timeNow)
                } else {
                    presentCountState.intValue += 1
                    totalCountState.intValue = maxOf(totalCountState.intValue, presentCountState.intValue)
                    uiState.value = ScanUiState.SuccessPresent(name, code, className, timeNow)
                }
            }.onFailure {
                // Face-protected sessions never fall back to unverified offline
                // attendance. A lecturer must use the manual review workflow.
                uiState.value = ScanUiState.Error("Mất kết nối máy chủ. Không ghi nhận điểm danh chưa xác minh.")
            }
            scanInFlight = false
        }
    }

    private fun submitFaceFrame(
        pending: PendingFaceVerification,
        imageDataUrl: String,
        durationMs: Long
    ) {
        val timeNow = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())
        lifecycleScope.launch {
            apiClient.submitFaceVerification(
                baseUrl = BuildConfig.API_BASE_URL,
                challengeId = pending.challengeId,
                imageDataUrl = imageDataUrl,
                livenessAction = pending.action,
                livenessDurationMs = durationMs,
                deviceUuid = deviceId
            ).onSuccess { json ->
                pendingFaceState.value = null
                if (!json.optBoolean("success", false)) {
                    uiState.value = ScanUiState.Error(json.optString("message", "Xác minh khuôn mặt không đạt"))
                    return@onSuccess
                }
                val student = json.optJSONObject("student")
                val attendance = json.optJSONObject("attendance")
                val name = student?.optString("fullName").orEmpty().ifBlank { pending.studentName }
                val code = student?.optString("studentCode").orEmpty().ifBlank { pending.studentCode }
                val className = student?.optString("className").orEmpty()
                presentCountState.intValue += 1
                totalCountState.intValue = maxOf(totalCountState.intValue, presentCountState.intValue)
                uiState.value = if (attendance?.optString("status") == "LATE") {
                    ScanUiState.SuccessLate(name, code, className, timeNow)
                } else {
                    ScanUiState.SuccessPresent(name, code, className, timeNow)
                }
            }.onFailure {
                pendingFaceState.value = null
                uiState.value = ScanUiState.Error("Không gửi được ảnh xác minh. Mời giảng viên kiểm tra.")
            }
        }
    }

    private suspend fun saveScanOffline(
        sessionId: String,
        cardUidHex: String
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val dao = AppDatabase.getInstance(this@MainActivity).offlineScanDao()
            val entity = OfflineScanEntity(
                requestId = UUID.randomUUID().toString(),
                sessionId = sessionId,
                cardUid = cardUidHex,
                deviceId = deviceId,
                clientScannedAt = Instant.now().toString(),
                syncStatus = "PENDING"
            )
            dao.insertScan(entity)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    private fun scheduleSync(baseUrl: String) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        val workRequest = OneTimeWorkRequestBuilder<OfflineScanSyncWorker>()
            .setConstraints(constraints)
            .setInputData(workDataOf(OfflineScanSyncWorker.BASE_URL_KEY to baseUrl))
            .build()
        WorkManager.getInstance(this).enqueue(workRequest)
    }

    private fun bytesToHex(bytes: ByteArray): String {
        val hexChars = CharArray(bytes.size * 2)
        for (j in bytes.indices) {
            val v = bytes[j].toInt() and 0xFF
            hexChars[j * 2] = "0123456789ABCDEF"[v ushr 4]
            hexChars[j * 2 + 1] = "0123456789ABCDEF"[v and 0x0F]
        }
        return String(hexChars)
    }

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun SetupScreen() {
        val pairingCode by pairingCodeState
        var baseUrl by remember { mutableStateOf(BuildConfig.API_BASE_URL) }
        val sessionId = "AUTO"
        val isPaired = false
        val scope = rememberCoroutineScope()
        var pairing by remember { mutableStateOf(false) }
        var setupError by remember { mutableStateOf("") }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(18.dp),
            contentAlignment = Alignment.Center
        ) {
            Surface(
                color = Color.White,
                shape = RoundedCornerShape(22.dp),
                shadowElevation = 8.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(24.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(bottom = 18.dp)
                    ) {
                        Image(
                            painter = painterResource(R.drawable.ic_brand_mark),
                            contentDescription = "DHV TapAttend",
                            modifier = Modifier
                                .size(46.dp)
                                .clip(RoundedCornerShape(12.dp))
                        )
                        Column(modifier = Modifier.padding(start = 11.dp)) {
                            Text(
                                text = "DHV TapAttend",
                                color = Color(0xFF10233F),
                                fontSize = 15.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                            Text(
                                text = "ATTENDANCE OS",
                                color = Color(0xFF64748B),
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.1.sp
                            )
                        }
                    }
                    Surface(
                        color = Color(0xFFE85555).copy(alpha = 0.1f),
                        shape = RoundedCornerShape(50)
                    ) {
                        Text(
                            text = "KÍCH HOẠT MỘT LẦN",
                            color = Color(0xFFE85555),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = 1.2.sp,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp)
                        )
                    }

                    Text(
                        text = "Ghép máy quét\nvới phòng học",
                        fontSize = 29.sp,
                        lineHeight = 34.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color(0xFF10233F),
                        modifier = Modifier.padding(top = 18.dp)
                    )
                    Text(
                        text = "Nhập mã 8 ký tự do Admin cấp. Sau đó máy tự nhận buổi học đang mở trong phòng.",
                        fontSize = 12.sp,
                        lineHeight = 19.sp,
                        color = Color(0xFF64748B),
                        modifier = Modifier.padding(top = 9.dp, bottom = 24.dp)
                    )

                    if (false) {
                    OutlinedTextField(
                        value = baseUrl,
                        onValueChange = { baseUrl = it },
                        label = { Text("Địa chỉ máy chủ") },
                        supportingText = { Text("Ví dụ: https://dhv-tap-attend.vercel.app") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true
                    )

                    Spacer(modifier = Modifier.height(12.dp))
                    }

                    if (!isPaired) {
                        OutlinedTextField(
                            value = pairingCode,
                            onValueChange = { pairingCodeState.value = it.uppercase().take(8) },
                            label = { Text("Mã ghép nối máy quét") },
                            placeholder = { Text("8 ký tự từ trang quản trị") },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            singleLine = true
                        )
                    } else {
                        Text(
                            text = "Máy quét đã ghép khóa an toàn",
                            color = Color(0xFF15805D),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    if (setupError.isNotBlank()) {
                        Text(
                            text = setupError,
                            color = Color(0xFFB91C1C),
                            fontSize = 11.sp,
                            modifier = Modifier.padding(top = 10.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    if (false) {
                    OutlinedTextField(
                        value = sessionId,
                        onValueChange = {},
                        label = { Text("Mã phiên điểm danh") },
                        placeholder = { Text("Nhập UUID hoặc mã 6 ký tự") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true
                    )
                    }

                    Spacer(modifier = Modifier.height(22.dp))

                    Button(
                        onClick = {
                            if (sessionId.isNotBlank() && baseUrl.isNotBlank() && (isPaired || pairingCode.length == 8)) {
                                if (isPaired) {
                                    if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                                        ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.CAMERA), 501)
                                    }
                                    isSetupCompleteState.value = true
                                    nfcAdapter?.enableForegroundDispatch(this@MainActivity, pendingIntent, intentFiltersArray, techListsArray)
                                    return@Button
                                }
                                pairing = true
                                setupError = ""
                                scope.launch {
                                    apiClient.pairDevice(baseUrl, pairingCode, deviceId)
                                        .onSuccess { json ->
                                            pairing = false
                                            if (!json.optBoolean("success", false)) {
                                                setupError = json.optString("message", "Không thể ghép nối máy quét")
                                                return@onSuccess
                                            }
                                            if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                                                ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.CAMERA), 501)
                                            }
                                            getSharedPreferences("tap_attend_device", MODE_PRIVATE)
                                                .edit()
                                                .putBoolean("paired", true)
                                                .putString("room_code", json.optString("roomCode"))
                                                .apply()
                                            roomCodeState.value = json.optString("roomCode")
                                            isPairedState.value = true
                                            isSetupCompleteState.value = true
                                            startSessionPolling()
                                            nfcAdapter?.enableForegroundDispatch(
                                                this@MainActivity,
                                                pendingIntent,
                                                intentFiltersArray,
                                                techListsArray
                                            )
                                        }
                                        .onFailure {
                                            pairing = false
                                            setupError = "Không kết nối được máy chủ ghép nối"
                                        }
                                }
                            } else {
                                Toast.makeText(
                                    this@MainActivity,
                                    "Vui lòng nhập đủ 8 ký tự mã ghép nối",
                                    Toast.LENGTH_SHORT
                                ).show()
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE85555)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(
                            text = if (pairing) "ĐANG GHÉP NỐI…" else "GHÉP NỐI MÁY QUÉT",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = 0.5.sp
                        )
                    }
                }
            }
        }
    }
}
