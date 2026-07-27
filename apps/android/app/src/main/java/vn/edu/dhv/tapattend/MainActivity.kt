package vn.edu.dhv.tapattend

import android.app.PendingIntent
import android.content.Intent
import android.content.IntentFilter
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import vn.edu.dhv.tapattend.network.ApiClient

class MainActivity : ComponentActivity() {

    private var nfcAdapter: NfcAdapter? = null
    private var pendingIntent: PendingIntent? = null
    private var intentFiltersArray: Array<IntentFilter>? = null
    private var techListsArray: Array<Array<String>>? = null

    // Compose State
    private var baseUrlState = mutableStateOf("https://diem-danh-dhv.vercel.app")
    private var sessionIdState = mutableStateOf("")
    private var isScanningState = mutableStateOf(false)
    private var scanResultState = mutableStateOf("")
    private var isErrorState = mutableStateOf(false)

    private val apiClient = ApiClient()

    @OptIn(ExperimentalMaterial3Api::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Init NFC
        nfcAdapter = NfcAdapter.getDefaultAdapter(this)
        
        val intent = Intent(this, javaClass).apply {
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        // Pass null for intent filters to catch all tags that match techListsArray
        intentFiltersArray = null
        techListsArray = arrayOf(
            arrayOf("android.nfc.tech.MifareClassic"),
            arrayOf("android.nfc.tech.IsoDep"),
            arrayOf("android.nfc.tech.NfcA")
        )

        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = Color(0xFF122B5A), // DHV Navy
                    secondary = Color(0xFFE31837), // DHV Red
                    background = Color(0xFFF8FAFC)
                )
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MainScreen()
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (nfcAdapter != null && isScanningState.value) {
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
            
            if (!isScanningState.value) {
                Toast.makeText(this, "Chưa bật chế độ điểm danh", Toast.LENGTH_SHORT).show()
                return
            }

            val tag: Tag? = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG)
            tag?.id?.let { uidBytes ->
                val hexUid = bytesToHex(uidBytes)
                handleTagScanned(hexUid)
            }
        }
    }

    private fun handleTagScanned(cardUidHex: String) {
        val baseUrl = baseUrlState.value
        val sessionId = sessionIdState.value

        if (baseUrl.isBlank() || sessionId.isBlank()) {
            scanResultState.value = "Vui lòng nhập Base URL và Session ID"
            isErrorState.value = true
            return
        }

        scanResultState.value = "Đang xử lý thẻ: $cardUidHex..."
        isErrorState.value = false

        // Coroutine to hit API
        val coroutineScope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main)
        coroutineScope.launch {
            val result = apiClient.submitNfcScan(baseUrl, sessionId, cardUidHex)
            result.onSuccess { msg ->
                scanResultState.value = msg
                isErrorState.value = false
            }.onFailure { ex ->
                scanResultState.value = ex.message ?: "Lỗi kết nối server"
                isErrorState.value = true
            }
        }
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
    fun MainScreen() {
        val baseUrl by baseUrlState
        val sessionId by sessionIdState
        val isScanning by isScanningState
        val scanResult by scanResultState
        val isError by isErrorState

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "TapAttend Scanner",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(top = 32.dp, bottom = 8.dp)
            )
            Text(
                text = "Hệ thống điểm danh NFC",
                fontSize = 14.sp,
                color = Color.Gray,
                modifier = Modifier.padding(bottom = 32.dp)
            )

            OutlinedTextField(
                value = baseUrl,
                onValueChange = { baseUrlState.value = it },
                label = { Text("Server Base URL (Vercel)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                colors = TextFieldDefaults.outlinedTextFieldColors(
                    focusedBorderColor = MaterialTheme.colorScheme.primary
                )
            )

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = sessionId,
                onValueChange = { sessionIdState.value = it },
                label = { Text("Mã Phiên Điểm Danh (Session ID)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                colors = TextFieldDefaults.outlinedTextFieldColors(
                    focusedBorderColor = MaterialTheme.colorScheme.primary
                )
            )

            Spacer(modifier = Modifier.height(32.dp))

            Button(
                onClick = {
                    isScanningState.value = !isScanning
                    if (isScanningState.value) {
                        nfcAdapter?.enableForegroundDispatch(
                            this@MainActivity,
                            pendingIntent,
                            intentFiltersArray,
                            techListsArray
                        )
                        scanResultState.value = "Sẵn sàng quét thẻ..."
                        isErrorState.value = false
                    } else {
                        nfcAdapter?.disableForegroundDispatch(this@MainActivity)
                        scanResultState.value = "Đã tắt máy quét"
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isScanning) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.primary
                )
            ) {
                Text(
                    text = if (isScanning) "DỪNG QUÉT" else "BẮT ĐẦU QUÉT",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(32.dp))

            if (scanResult.isNotEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            color = if (isError) Color(0xFFFFEBEE) else Color(0xFFE8F5E9),
                            shape = RoundedCornerShape(8.dp)
                        )
                        .padding(16.dp)
                ) {
                    Text(
                        text = scanResult,
                        color = if (isError) Color(0xFFC62828) else Color(0xFF2E7D32),
                        fontWeight = FontWeight.Medium,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
            
            Spacer(modifier = Modifier.weight(1f))
            
            Text(
                text = if (nfcAdapter == null) "⚠️ Điện thoại không hỗ trợ NFC" else "✅ NFC sẵn sàng",
                fontSize = 12.sp,
                color = if (nfcAdapter == null) Color.Red else Color.Gray,
                modifier = Modifier.padding(bottom = 16.dp)
            )
        }
    }
}
