package vn.edu.dhv.tapattend.presentation

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
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
import kotlinx.coroutines.delay

sealed class ScanUiState {
    object Idle : ScanUiState()
    data class SuccessPresent(val name: String, val code: String, val className: String, val time: String) : ScanUiState()
    data class SuccessLate(val name: String, val code: String, val className: String, val time: String) : ScanUiState()
    data class AlreadyAttended(val name: String, val time: String) : ScanUiState()
    data class Error(val message: String) : ScanUiState()
}

@Composable
fun NfcScanScreen(
    courseName: String = "LẬP TRÌNH WEB",
    className: String = "CT07PM",
    roomCode: String = "A301",
    presentCount: Int = 24,
    totalCount: Int = 31,
    uiState: ScanUiState = ScanUiState.Idle,
    onResetState: () -> Unit = {}
) {
    // Auto reset state after 1.5 seconds
    LaunchedEffect(uiState) {
        if (uiState !is ScanUiState.Idle) {
            delay(1500)
            onResetState()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0B132B))
            .padding(24.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {

            // Header Section
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = courseName.uppercase(),
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "$className · $roomCode",
                    color = Color(0xFF94A3B8),
                    fontSize = 14.sp,
                    modifier = Modifier.padding(top = 4.dp)
                )

                Spacer(modifier = Modifier.height(16.dp))

                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = Color(0xFF1E293B),
                    modifier = Modifier.padding(vertical = 8.dp)
                ) {
                    Text(
                        text = "Đã điểm danh: $presentCount/$totalCount",
                        color = Color(0xFF10B981),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
                    )
                }
            }

            // Center Dynamic Area (Touch Box OR Result Card)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(280.dp),
                contentAlignment = Alignment.Center
            ) {
                when (uiState) {
                    is ScanUiState.Idle -> {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .border(
                                    width = 2.dp,
                                    color = Color(0xFF334155),
                                    shape = RoundedCornerShape(24.dp)
                                )
                                .background(Color(0xFF1E293B).copy(alpha = 0.5f), shape = RoundedCornerShape(24.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = "CHẠM THẺ VÀO ĐIỆN THOẠI",
                                    color = Color.White,
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    textAlign = TextAlign.Center
                                )
                                Text(
                                    text = "MIFARE Classic 1K",
                                    color = Color(0xFF64748B),
                                    fontSize = 12.sp,
                                    modifier = Modifier.padding(top = 8.dp)
                                )
                            }
                        }
                    }

                    is ScanUiState.SuccessPresent -> {
                        ResultCard(
                            backgroundColor = Color(0xFF16A34A),
                            statusTitle = "✓ ĐIỂM DANH THÀNH CÔNG",
                            name = uiState.name,
                            code = uiState.code,
                            className = uiState.className,
                            time = "${uiState.time} · CÓ MẶT"
                        )
                    }

                    is ScanUiState.SuccessLate -> {
                        ResultCard(
                            backgroundColor = Color(0xFFEA580C),
                            statusTitle = "✓ ĐIỂM DANH (ĐI MUỘN)",
                            name = uiState.name,
                            code = uiState.code,
                            className = uiState.className,
                            time = "${uiState.time} · ĐI MUỘN"
                        )
                    }

                    is ScanUiState.AlreadyAttended -> {
                        ResultCard(
                            backgroundColor = Color(0xFF2563EB),
                            statusTitle = "ℹ ĐÃ ĐIỂM DANH TRƯỚC ĐÓ",
                            name = uiState.name,
                            code = "",
                            className = "",
                            time = "Lúc ${uiState.time}"
                        )
                    }

                    is ScanUiState.Error -> {
                        ResultCard(
                            backgroundColor = Color(0xFFDC2626),
                            statusTitle = "✕ TỪ CHỐI QUYỀN ĐIỂM DANH",
                            name = uiState.message,
                            code = "",
                            className = "",
                            time = "Thẻ không hợp lệ"
                        )
                    }
                }
            }

            // Footer Indicators
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceAround
            ) {
                Text(text = "NFC: Đã bật", color = Color(0xFF10B981), fontSize = 12.sp)
                Text(text = "Mạng: Trực tuyến", color = Color(0xFF10B981), fontSize = 12.sp)
                Text(text = "Phiên: Đang mở", color = Color(0xFF10B981), fontSize = 12.sp)
            }

        }
    }
}

@Composable
fun ResultCard(
    backgroundColor: Color,
    statusTitle: String,
    name: String,
    code: String,
    className: String,
    time: String
) {
    Surface(
        shape = RoundedCornerShape(24.dp),
        color = backgroundColor,
        modifier = Modifier.fillMaxSize()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = statusTitle,
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = name,
                color = Color.White,
                fontSize = 24.sp,
                fontWeight = FontWeight.ExtraBold,
                textAlign = TextAlign.Center
            )
            if (code.isNotEmpty()) {
                Text(
                    text = "MSSV: $code",
                    color = Color.White.copy(alpha = 0.9f),
                    fontSize = 14.sp,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
            if (className.isNotEmpty()) {
                Text(
                    text = "Lớp: $className",
                    color = Color.White.copy(alpha = 0.9f),
                    fontSize = 14.sp
                )
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = time,
                color = Color.White.copy(alpha = 0.9f),
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}
