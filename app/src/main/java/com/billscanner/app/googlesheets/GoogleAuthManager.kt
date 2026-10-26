package com.billscanner.app.googlesheets

import android.content.Context
import android.content.Intent
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.Scope
import com.google.api.services.sheets.v4.SheetsScopes

class GoogleAuthManager(private val context: Context) {

    val sheetsScope = Scope(SheetsScopes.SPREADSHEETS)
    val driveScope = Scope(SheetsScopes.DRIVE_FILE)

    val googleSignInOptions: GoogleSignInOptions = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
        .requestEmail()
        .requestScopes(sheetsScope, driveScope)
        .build()

    val fallbackSignInOptions: GoogleSignInOptions = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
        .requestEmail()
        .build()

    val googleSignInClient: GoogleSignInClient = GoogleSignIn.getClient(context, googleSignInOptions)

    fun getSignedInAccount(): GoogleSignInAccount? {
        return GoogleSignIn.getLastSignedInAccount(context)
    }

    fun hasSheetsPermissions(account: GoogleSignInAccount?): Boolean {
        return account != null && GoogleSignIn.hasPermissions(account, sheetsScope, driveScope)
    }

    fun getSignInIntent(): Intent {
        return googleSignInClient.signInIntent
    }

    fun getFallbackSignInIntent(): Intent {
        return GoogleSignIn.getClient(context, fallbackSignInOptions).signInIntent
    }

    fun signOut(onComplete: () -> Unit) {
        googleSignInClient.signOut().addOnCompleteListener { onComplete() }
    }
}
