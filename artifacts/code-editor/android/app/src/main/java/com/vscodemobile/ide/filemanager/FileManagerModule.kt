package com.vscodemobile.ide.filemanager

import com.facebook.react.bridge.*
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.channels.FileChannel
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipOutputStream

/**
 * React Native module for advanced file management operations.
 * Handles ZIP creation/extraction, large file reads in chunks, rename, copy, move, delete.
 */
class FileManagerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FileManagerModule"

    @ReactMethod
    fun readFileLarge(filePath: String, offset: Int, length: Int, promise: Promise) {
        Thread {
            try {
                val file = File(filePath)
                val bytes = ByteArray(length)
                val raf = java.io.RandomAccessFile(file, "r")
                raf.seek(offset.toLong())
                val read = raf.read(bytes)
                raf.close()
                val text = String(bytes, 0, if (read == -1) 0 else read, Charsets.UTF_8)
                promise.resolve(text)
            } catch (e: Exception) {
                promise.reject("READ_ERROR", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun getFileInfo(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (!file.exists()) {
                promise.reject("NOT_FOUND", "File not found: $filePath")
                return
            }
            val map = Arguments.createMap().apply {
                putString("name", file.name)
                putString("path", file.absolutePath)
                putString("parent", file.parent)
                putBoolean("isDirectory", file.isDirectory)
                putBoolean("isFile", file.isFile)
                putBoolean("canRead", file.canRead())
                putBoolean("canWrite", file.canWrite())
                putDouble("size", file.length().toDouble())
                putDouble("lastModified", file.lastModified().toDouble())
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("INFO_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun renameFile(fromPath: String, toPath: String, promise: Promise) {
        Thread {
            try {
                val from = File(fromPath)
                val to = File(toPath)
                if (!from.exists()) { promise.reject("NOT_FOUND", "Source not found"); return@Thread }
                if (to.exists()) { promise.reject("EXISTS", "Destination already exists"); return@Thread }
                val success = from.renameTo(to)
                if (success) promise.resolve(toPath)
                else promise.reject("RENAME_FAILED", "Could not rename file")
            } catch (e: Exception) {
                promise.reject("RENAME_ERROR", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun copyFile(fromPath: String, toPath: String, promise: Promise) {
        Thread {
            try {
                val src = File(fromPath)
                val dst = File(toPath)
                if (!src.exists()) { promise.reject("NOT_FOUND", "Source not found"); return@Thread }
                dst.parentFile?.mkdirs()
                FileInputStream(src).channel.use { inCh ->
                    FileOutputStream(dst).channel.use { outCh ->
                        inCh.transferTo(0, inCh.size(), outCh)
                    }
                }
                promise.resolve(toPath)
            } catch (e: Exception) {
                promise.reject("COPY_ERROR", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun moveFile(fromPath: String, toPath: String, promise: Promise) {
        Thread {
            try {
                val src = File(fromPath)
                val dst = File(toPath)
                if (!src.exists()) { promise.reject("NOT_FOUND", "Source not found"); return@Thread }
                dst.parentFile?.mkdirs()
                if (src.renameTo(dst)) {
                    promise.resolve(toPath)
                } else {
                    // Cross-filesystem move: copy then delete
                    FileInputStream(src).channel.use { inCh ->
                        FileOutputStream(dst).channel.use { outCh -> inCh.transferTo(0, inCh.size(), outCh) }
                    }
                    src.delete()
                    promise.resolve(toPath)
                }
            } catch (e: Exception) {
                promise.reject("MOVE_ERROR", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun deleteFile(path: String, recursive: Boolean, promise: Promise) {
        Thread {
            try {
                val file = File(path)
                val success = if (recursive) deleteRecursive(file) else file.delete()
                if (success) promise.resolve(true)
                else promise.reject("DELETE_FAILED", "Could not delete: $path")
            } catch (e: Exception) {
                promise.reject("DELETE_ERROR", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun createZip(sourcePath: String, zipPath: String, promise: Promise) {
        Thread {
            try {
                val source = File(sourcePath)
                val zip = File(zipPath)
                zip.parentFile?.mkdirs()
                ZipOutputStream(FileOutputStream(zip)).use { zos ->
                    addToZip(source, source.name, zos)
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
    fun searchInFile(filePath: String, query: String, caseSensitive: Boolean, promise: Promise) {
        Thread {
            try {
                val results = Arguments.createArray()
                val file = File(filePath)
                if (!file.exists() || !file.isFile) { promise.resolve(results); return@Thread }
                val q = if (caseSensitive) query else query.lowercase()
                file.bufferedReader().useLines { lines ->
                    lines.forEachIndexed { idx, line ->
                        val lineCheck = if (caseSensitive) line else line.lowercase()
                        if (lineCheck.contains(q)) {
                            val map = Arguments.createMap().apply {
                                putInt("line", idx + 1)
                                putString("content", line.trim())
                                putInt("column", lineCheck.indexOf(q))
                            }
                            results.pushMap(map)
                        }
                    }
                }
                promise.resolve(results)
            } catch (e: Exception) {
                promise.reject("SEARCH_ERROR", e.message, e)
            }
        }.start()
    }

    private fun deleteRecursive(file: File): Boolean {
        if (file.isDirectory) {
            file.listFiles()?.forEach { deleteRecursive(it) }
        }
        return file.delete()
    }

    private fun addToZip(file: File, name: String, zos: ZipOutputStream) {
        if (file.isDirectory) {
            file.listFiles()?.forEach { child ->
                addToZip(child, "$name/${child.name}", zos)
            }
        } else {
            zos.putNextEntry(ZipEntry(name))
            file.inputStream().use { it.copyTo(zos) }
            zos.closeEntry()
        }
    }
}
