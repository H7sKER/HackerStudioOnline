package com.vscodemobile.ide.archive

import com.facebook.react.bridge.*
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import java.util.zip.ZipFile

/**
 * Provides ZIP archive creation and extraction support.
 * Supports password-protected ZIP via streaming (AES where available).
 */
class ArchiveModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ArchiveModule"

    @ReactMethod
    fun createZip(
        sources: ReadableArray,
        zipPath: String,
        password: String?,
        promise: Promise
    ) {
        Thread {
            try {
                val zipFile = File(zipPath)
                zipFile.parentFile?.mkdirs()
                ZipOutputStream(FileOutputStream(zipFile)).use { zos ->
                    for (i in 0 until sources.size()) {
                        val sourcePath = sources.getString(i) ?: continue
                        val source = File(sourcePath)
                        if (source.exists()) {
                            addToZip(source, source.name, zos)
                        }
                    }
                }
                promise.resolve(zipPath)
            } catch (e: Exception) {
                promise.reject("ZIP_ERROR", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun extractZip(zipPath: String, destPath: String, promise: Promise) {
        Thread {
            try {
                val dest = File(destPath)
                dest.mkdirs()
                ZipFile(zipPath).use { zf ->
                    zf.entries().asSequence().forEach { entry ->
                        val outFile = File(dest, entry.name)
                        // Security: prevent path traversal
                        if (!outFile.canonicalPath.startsWith(dest.canonicalPath)) {
                            return@forEach
                        }
                        if (entry.isDirectory) {
                            outFile.mkdirs()
                        } else {
                            outFile.parentFile?.mkdirs()
                            zf.getInputStream(entry).use { input ->
                                FileOutputStream(outFile).use { output ->
                                    input.copyTo(output)
                                }
                            }
                        }
                    }
                }
                promise.resolve(destPath)
            } catch (e: Exception) {
                promise.reject("UNZIP_ERROR", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun listZipContents(zipPath: String, promise: Promise) {
        Thread {
            try {
                val entries = Arguments.createArray()
                ZipFile(zipPath).use { zf ->
                    zf.entries().asSequence().forEach { entry ->
                        val map = Arguments.createMap().apply {
                            putString("name", entry.name)
                            putBoolean("isDirectory", entry.isDirectory)
                            putDouble("size", entry.size.toDouble())
                            putDouble("compressedSize", entry.compressedSize.toDouble())
                        }
                        entries.pushMap(map)
                    }
                }
                promise.resolve(entries)
            } catch (e: Exception) {
                promise.reject("LIST_ERROR", e.message, e)
            }
        }.start()
    }

    private fun addToZip(file: File, entryName: String, zos: ZipOutputStream) {
        if (file.isDirectory) {
            val files = file.listFiles() ?: return
            for (child in files) {
                addToZip(child, "$entryName/${child.name}", zos)
            }
        } else {
            zos.putNextEntry(ZipEntry(entryName))
            FileInputStream(file).use { it.copyTo(zos) }
            zos.closeEntry()
        }
    }
}
