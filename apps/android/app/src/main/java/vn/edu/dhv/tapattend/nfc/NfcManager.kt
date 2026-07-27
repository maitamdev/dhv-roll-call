package vn.edu.dhv.tapattend.nfc

import android.nfc.Tag
import android.nfc.tech.MifareClassic
import android.nfc.tech.NfcA
import java.util.Locale

object NfcManager {

    private var lastScannedUid: String? = null
    private var lastScannedTime: Long = 0L
    private const val DEBOUNCE_INTERVAL_MS = 1500L // 1.5 seconds anti-debounce threshold

    /**
     * Extracts and normalizes the NFC Card UID from Tag object using Tag.getId()
     */
    fun extractUid(tag: Tag): String {
        val rawBytes = tag.id ?: return ""
        return bytesToHex(rawBytes)
    }

    /**
     * Checks whether the tag contains MIFARE Classic 1K technology.
     */
    fun isMifareClassic(tag: Tag): Boolean {
        val techList = tag.techList
        return techList.contains(MifareClassic::class.java.name) || techList.contains(NfcA::class.java.name)
    }

    /**
     * Converts byte array to Uppercase Hex String. E.g. [0x80, 0x74, 0xA1, 0xB2] -> "8074A1B2"
     */
    fun bytesToHex(bytes: ByteArray): String {
        val sb = StringBuilder()
        for (b in bytes) {
            sb.append(String.format(Locale.US, "%02X", b))
        }
        return sb.toString()
    }

    /**
     * Checks if the scanned UID is a duplicate read within short interval.
     */
    fun isDuplicateScan(uid: String): Boolean {
        val currentTime = System.currentTimeMillis()
        if (uid == lastScannedUid && (currentTime - lastScannedTime) < DEBOUNCE_INTERVAL_MS) {
            return true
        }
        lastScannedUid = uid
        lastScannedTime = currentTime
        return false
    }

    fun resetDebounce() {
        lastScannedUid = null
        lastScannedTime = 0L
    }
}
