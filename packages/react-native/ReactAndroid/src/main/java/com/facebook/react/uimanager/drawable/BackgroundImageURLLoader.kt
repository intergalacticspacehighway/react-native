/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

package com.facebook.react.uimanager.drawable

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import com.facebook.common.executors.CallerThreadExecutor
import com.facebook.common.logging.FLog
import com.facebook.common.references.CloseableReference
import com.facebook.datasource.BaseDataSubscriber
import com.facebook.datasource.DataSource
import com.facebook.drawee.backends.pipeline.Fresco
import com.facebook.imagepipeline.common.ImageDecodeOptions
import com.facebook.imagepipeline.image.CloseableImage
import com.facebook.imagepipeline.image.CloseableStaticBitmap
import com.facebook.imagepipeline.request.ImageRequestBuilder
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.common.ReactConstants
import com.facebook.react.uimanager.style.BackgroundImageLayer
import com.facebook.react.views.imagehelper.ImageSource

/**
 * Loads the `url()` layers of a view's background image. Keeps one request for each unique uri and
 * calls [onLoad] on the UI thread each time an image finishes loading. Use it only on the UI
 * thread.
 */
internal class BackgroundImageURLLoader(
    private val context: Context,
    private val onLoad: () -> Unit,
) {

  private var entries: List<Entry> = emptyList()

  /**
   * Requests every `url()` layer in [backgroundImageLayers]. Does nothing if the uris did not
   * change since the last call. Cancels all requests when there are no `url()` layers.
   */
  fun loadBackgroundImages(backgroundImageLayers: List<BackgroundImageLayer>) {
    val distinctUris =
        backgroundImageLayers.mapNotNull { it.uri }.filter { it.isNotEmpty() }.distinct()
    if (distinctUris == entries.map { it.uri }) {
      return
    }

    // Keep the entries for uris that are still used, so their images do not disappear while the
    // new ones load.
    val newEntries = mutableListOf<Entry>()
    val nextEntries =
        distinctUris.map { uri ->
          entries.find { it.uri == uri } ?: Entry(uri).also { newEntries.add(it) }
        }
    entries.filter { it !in nextEntries }.forEach { it.cancel() }
    entries = nextEntries
    newEntries.forEach { it.start() }
  }

  /**
   * Cancels the requests that are still loading. Loaded images stay. The next
   * [loadBackgroundImages] call requests the cancelled uris again.
   */
  fun cancelPendingRequests() {
    val (loaded, pending) = entries.partition { it.image != null }
    pending.forEach { it.cancel() }
    entries = loaded
  }

  /** Returns null until the image for [uri] has loaded. */
  fun imageForUri(uri: String): Bitmap? = entries.find { it.uri == uri }?.image

  private inner class Entry(val uri: String) {
    var image: Bitmap? = null
      private set

    private var dataSource: DataSource<CloseableReference<CloseableImage>>? = null
    private var cancelled = false

    fun start() {
      val imageRequest =
          ImageRequestBuilder.newBuilderWithSource(ImageSource(context, uri).uri)
              // Like iOS, animated images show their first frame.
              .setImageDecodeOptions(
                  ImageDecodeOptions.newBuilder().setForceStaticImage(true).build()
              )
              .build()
      val dataSource = Fresco.getImagePipeline().fetchDecodedImage(imageRequest, null)
      this.dataSource = dataSource
      dataSource.subscribe(
          object : BaseDataSubscriber<CloseableReference<CloseableImage>>() {
            override fun onNewResultImpl(
                dataSource: DataSource<CloseableReference<CloseableImage>>
            ) {
              if (!dataSource.isFinished) {
                return
              }
              val imageReference = dataSource.result ?: return
              // The pipeline reuses the decoded bitmap after the reference is closed, so keep a
              // copy.
              val uprightImage =
                  try {
                    (imageReference.get() as? CloseableStaticBitmap)?.let { uprightImage(it) }
                  } finally {
                    CloseableReference.closeSafely(imageReference)
                  }
              if (uprightImage == null) {
                FLog.w(ReactConstants.TAG, "Could not copy bitmap for background image: %s", uri)
                return
              }
              UiThreadUtil.runOnUiThread {
                if (!cancelled) {
                  image = uprightImage
                  onLoad()
                }
              }
            }

            override fun onFailureImpl(dataSource: DataSource<CloseableReference<CloseableImage>>) {
              FLog.w(
                  ReactConstants.TAG,
                  dataSource.failureCause,
                  "Failed to load background image: %s",
                  uri,
              )
            }
          },
          CallerThreadExecutor.getInstance(),
      )
    }

    fun cancel() {
      cancelled = true
      dataSource?.close()
    }
  }

  private companion object {
    /**
     * Copies the decoded bitmap with its EXIF orientation applied. The pipeline only reports the
     * orientation, and Fresco's drawee applies it when it draws, in the same way as below.
     */
    fun uprightImage(image: CloseableStaticBitmap): Bitmap? {
      val source = image.underlyingBitmap ?: return null
      val exifOrientation = image.exifOrientation
      val rotationAngle = image.rotationAngle
      if (rotationAngle <= 0 && exifOrientation <= 1) {
        return source.copy(source.config ?: Bitmap.Config.ARGB_8888, false)
      }
      val matrix = Matrix()
      when (exifOrientation) {
        2 -> matrix.setScale(-1f, 1f)
        4 -> matrix.setScale(1f, -1f)
        5 -> {
          matrix.setRotate(270f)
          matrix.postScale(1f, -1f)
        }
        7 -> {
          matrix.setRotate(270f)
          matrix.postScale(-1f, 1f)
        }
        else -> matrix.setRotate(rotationAngle.toFloat())
      }
      return Bitmap.createBitmap(source, 0, 0, source.width, source.height, matrix, true)
    }
  }
}
