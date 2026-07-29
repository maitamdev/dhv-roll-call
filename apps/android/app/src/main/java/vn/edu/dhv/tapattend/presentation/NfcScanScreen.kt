package vn.edu.dhv.tapattend.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import vn.edu.dhv.tapattend.R

private val Navy = Color(0xFF10233F)
private val Coral = Color(0xFFE85555)
private val Canvas = Color(0xFFF4F7FA)
private val Slate = Color(0xFF64748B)
private val Border = Color(0xFFE2E8F0)
private val Emerald = Color(0xFF16A36A)
private val Amber = Color(0xFFE09A32)

sealed class ScanUiState {
    data class Waiting(val message: String) : ScanUiState()
    object Idle : ScanUiState()
    data class SuccessPresent(val name: String, val code: String, val className: String, val time: String) : ScanUiState()
    data class SuccessLate(val name: String, val code: String, val className: String, val time: String) : ScanUiState()
    data class AlreadyAttended(val name: String, val time: String) : ScanUiState()
    data class OfflineQueued(val time: String) : ScanUiState()
    data class Error(val message: String) : ScanUiState()
}

@Composable
fun NfcScanScreen(
    courseName: String = "PHIÊN ĐIỂM DANH",
    className: String = "CHƯA CÓ LỚP",
    roomCode: String = "CHƯA GÁN",
    presentCount: Int = 0,
    totalCount: Int = 0,
    sessionActive: Boolean = true,
    uiState: ScanUiState = ScanUiState.Idle,
    onResetState: () -> Unit = {}
) {
    LaunchedEffect(uiState) {
        if (uiState !is ScanUiState.Idle && uiState !is ScanUiState.Waiting) {
            delay(2200)
            onResetState()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Canvas)
    ) {
        Surface(
            color = Navy,
            shape = RoundedCornerShape(bottomStart = 28.dp, bottomEnd = 28.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(horizontal = 22.dp, vertical = 22.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Image(
                            painter = painterResource(R.drawable.ic_brand_mark),
                            contentDescription = "DHV TapAttend",
                            modifier = Modifier
                                .size(43.dp)
                                .clip(RoundedCornerShape(11.dp))
                        )
                        Column(modifier = Modifier.padding(start = 11.dp)) {
                            Text(
                                text = courseName,
                                color = Color.White,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                            Text(
                                text = "$className  ·  PHÒNG $roomCode",
                                color = Color(0xFFB6C2D1),
                                fontSize = 10.sp,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
                    }
                    Surface(
                        color = Color.White.copy(alpha = 0.08f),
                        shape = RoundedCornerShape(50)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 11.dp, vertical = 7.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(7.dp)
                                .background(if (sessionActive) Emerald else Amber, CircleShape)
                            )
                            Text(
                                text = if (sessionActive) " ĐANG MỞ" else " CHỜ PHIÊN",
                                color = if (sessionActive) Color(0xFF8CE3BE) else Color(0xFFFFD48A),
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 18.dp, vertical = 18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            AttendanceProgress(presentCount, totalCount)

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                when (uiState) {
                    is ScanUiState.Waiting -> ResultCard(
                        accent = Amber,
                        eyebrow = "MÁY QUÉT ĐÃ SẴN SÀNG",
                        name = uiState.message,
                        meta = "Hệ thống tự kiểm tra phiên đang mở mỗi 10 giây",
                        footer = "KHÔNG CẦN NHẬP MÃ PHIÊN"
                    )
                    is ScanUiState.Idle -> ReadyToScanCard()
                    is ScanUiState.SuccessPresent -> ResultCard(
                        accent = Emerald,
                        eyebrow = "ĐIỂM DANH THÀNH CÔNG",
                        name = uiState.name,
                        meta = "MSSV ${uiState.code}  ·  ${uiState.className}",
                        footer = "${uiState.time}  ·  CÓ MẶT"
                    )
                    is ScanUiState.SuccessLate -> ResultCard(
                        accent = Amber,
                        eyebrow = "ĐÃ GHI NHẬN ĐI MUỘN",
                        name = uiState.name,
                        meta = "MSSV ${uiState.code}  ·  ${uiState.className}",
                        footer = "${uiState.time}  ·  ĐI MUỘN"
                    )
                    is ScanUiState.AlreadyAttended -> ResultCard(
                        accent = Color(0xFF3B82F6),
                        eyebrow = "ĐÃ ĐIỂM DANH TRƯỚC ĐÓ",
                        name = uiState.name,
                        meta = "Không tạo thêm bản ghi",
                        footer = "Lần quét lúc ${uiState.time}"
                    )
                    is ScanUiState.OfflineQueued -> ResultCard(
                        accent = Slate,
                        eyebrow = "ĐÃ LƯU NGOẠI TUYẾN",
                        name = "Lượt quét đang chờ đồng bộ",
                        meta = "Dữ liệu sẽ tự gửi khi có mạng",
                        footer = uiState.time
                    )
                    is ScanUiState.Error -> ResultCard(
                        accent = Coral,
                        eyebrow = "KHÔNG THỂ GHI NHẬN",
                        name = uiState.message,
                        meta = "Vui lòng kiểm tra thẻ và thử lại",
                        footer = "LƯỢT QUÉT BỊ TỪ CHỐI"
                    )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                SystemBadge("NFC", "SẴN SÀNG", Emerald, Modifier.weight(1f))
                SystemBadge("MẠNG", "TRỰC TUYẾN", Emerald, Modifier.weight(1f))
                SystemBadge("CAMERA", "SẴN SÀNG", Color(0xFF3B82F6), Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun AttendanceProgress(presentCount: Int, totalCount: Int) {
    val progress = if (totalCount > 0) presentCount.toFloat() / totalCount else 0f
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Border, RoundedCornerShape(16.dp))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom
            ) {
                Column {
                    Text("TIẾN ĐỘ ĐIỂM DANH", color = Slate, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    Text(
                        "$presentCount / $totalCount sinh viên",
                        color = Navy,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.ExtraBold,
                        modifier = Modifier.padding(top = 3.dp)
                    )
                }
                Text("${(progress * 100).toInt()}%", color = Emerald, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
            }
            LinearProgressIndicator(
                progress = progress.coerceIn(0f, 1f),
                color = Emerald,
                trackColor = Color(0xFFE8EEF3),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp)
                    .height(7.dp)
            )
        }
    }
}

@Composable
private fun ReadyToScanCard() {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(22.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Border, RoundedCornerShape(22.dp))
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 30.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(118.dp)
                    .border(1.dp, Coral.copy(alpha = 0.18f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(86.dp)
                        .background(Coral.copy(alpha = 0.08f), CircleShape)
                        .border(1.dp, Coral.copy(alpha = 0.22f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text("NFC", color = Coral, fontSize = 19.sp, fontWeight = FontWeight.ExtraBold)
                }
            }
            Text(
                text = "CHẠM THẺ VÀO ĐIỆN THOẠI",
                color = Navy,
                fontSize = 16.sp,
                fontWeight = FontWeight.ExtraBold,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 22.dp)
            )
            Text(
                text = "Giữ thẻ ổn định trong 1–2 giây",
                color = Slate,
                fontSize = 11.sp,
                modifier = Modifier.padding(top = 7.dp)
            )
        }
    }
}

@Composable
private fun ResultCard(accent: Color, eyebrow: String, name: String, meta: String, footer: String) {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(22.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, accent.copy(alpha = 0.28f), RoundedCornerShape(22.dp))
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(54.dp)
                    .background(accent.copy(alpha = 0.1f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text("✓", color = accent, fontSize = 25.sp, fontWeight = FontWeight.ExtraBold)
            }
            Text(
                text = eyebrow,
                color = accent,
                fontSize = 10.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 1.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 17.dp)
            )
            Text(
                text = name,
                color = Navy,
                fontSize = 21.sp,
                fontWeight = FontWeight.ExtraBold,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 8.dp)
            )
            Text(
                text = meta,
                color = Slate,
                fontSize = 11.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 7.dp)
            )
            Spacer(modifier = Modifier.height(18.dp))
            Surface(color = accent.copy(alpha = 0.08f), shape = RoundedCornerShape(50)) {
                Text(
                    text = footer,
                    color = accent,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp)
                )
            }
        }
    }
}

@Composable
private fun SystemBadge(label: String, value: String, tone: Color, modifier: Modifier = Modifier) {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(12.dp),
        modifier = modifier.border(1.dp, Border, RoundedCornerShape(12.dp))
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 9.dp, vertical = 9.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(label, color = Slate, fontSize = 8.sp, fontWeight = FontWeight.Bold)
            Text(value, color = tone, fontSize = 8.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 2.dp))
        }
    }
}
