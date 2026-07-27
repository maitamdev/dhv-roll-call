package vn.edu.dhv.tapattend.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun NfcDiagnosticScreen(
    nfcSupported: Boolean = true,
    nfcEnabled: Boolean = true,
    cardType: String = "MIFARE Classic 1K",
    techList: List<String> = listOf("android.nfc.tech.MifareClassic", "android.nfc.tech.NfcA"),
    maskedUid: String = "80:74:**:**",
    successCount: Int = 42,
    errorCount: Int = 1
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0B132B))
            .padding(20.dp)
    ) {
        Text(
            text = "KIỂM TRA CHẨN ĐOÁN NFC (NCKH)",
            color = Color.White,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "Thông số phần cứng và công nghệ thẻ ghi nhận từ Tag.getId()",
            color = Color(0xFF94A3B8),
            fontSize = 12.sp,
            modifier = Modifier.padding(bottom = 20.dp)
        )

        Surface(
            shape = RoundedCornerShape(16.dp),
            color = Color(0xFF1E293B),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                DiagnosticItem("Phần cứng NFC", if (nfcSupported) "Hỗ trợ" else "Không hỗ trợ", true)
                DiagnosticItem("Trạng thái NFC", if (nfcEnabled) "Đã bật" else "Đang tắt", nfcEnabled)
                DiagnosticItem("Loại thẻ nhận dạng", cardType, true)
                DiagnosticItem("UID Đã che", maskedUid, true)
                DiagnosticItem("Lượt quét thành công", "$successCount lượt", true)
                DiagnosticItem("Lượt quét thất bại", "$errorCount lượt", false)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Công nghệ thẻ khả dụng:",
            color = Color.White,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(bottom = 8.dp)
        )

        techList.forEach { tech ->
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = Color(0xFF334155),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp)
            ) {
                Text(
                    text = tech,
                    color = Color(0xFFE2E8F0),
                    fontSize = 12.sp,
                    modifier = Modifier.padding(12.dp)
                )
            }
        }
    }
}

@Composable
fun DiagnosticItem(label: String, value: String, isOk: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, color = Color(0xFF94A3B8), fontSize = 13.sp)
        Text(
            text = value,
            color = if (isOk) Color(0xFF10B981) else Color(0xFFEF4444),
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold
        )
    }
}
