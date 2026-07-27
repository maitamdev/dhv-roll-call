package vn.edu.dhv.tapattend.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature
import java.util.Base64

object KeystoreHelper {

    private const val KEY_ALIAS = "DHV_TAP_ATTEND_DEVICE_KEY"
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"

    fun getOrCreateKeyPair() {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        if (!keyStore.containsAlias(KEY_ALIAS)) {
            val keyPairGenerator = KeyPairGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_RSA,
                ANDROID_KEYSTORE
            )
            val spec = KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
            )
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setSignaturePaddings(KeyProperties.SIGNATURE_PADDING_RSA_PKCS1)
                .build()

            keyPairGenerator.initialize(spec)
            keyPairGenerator.generateKeyPair()
        }
    }

    fun signData(data: String): String {
        try {
            getOrCreateKeyPair()
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
            val privateKey = keyStore.getKey(KEY_ALIAS, null) as PrivateKey

            val signature = Signature.getInstance("SHA256withRSA")
            signature.initSign(privateKey)
            signature.update(data.toByteArray(Charsets.UTF_8))

            val signedBytes = signature.sign()
            return Base64.getEncoder().encodeToString(signedBytes)
        } catch (e: Exception) {
            return "UNSIGNED_FALLBACK"
        }
    }
}
