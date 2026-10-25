/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

package com.facebook.react.views.text

import android.view.ActionMode
import android.view.Menu
import android.view.MenuItem
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event

internal data class SelectionMenuItem(val id: String, val title: String)

internal fun selectionMenuItemsFromArray(items: ReadableArray?): List<SelectionMenuItem> {
  if (items == null) {
    return emptyList()
  }
  return (0 until items.size()).mapNotNull { index ->
    val item = items.getMap(index) ?: return@mapNotNull null
    val id = item.getString("id") ?: return@mapNotNull null
    val title = item.getString("title") ?: return@mapNotNull null
    SelectionMenuItem(id, title)
  }
}

/**
 * Adds the `selectionMenuItems` of a `<Text selectable>` to its selection menu. `TextView` fills
 * the menu with its system items, then calls [onCreateActionMode].
 */
internal class SelectionMenuItemsCallback(
    private val view: ReactTextView,
    private val items: List<SelectionMenuItem>,
) : ActionMode.Callback {
  private val addedItems = mutableMapOf<MenuItem, SelectionMenuItem>()

  override fun onCreateActionMode(mode: ActionMode, menu: Menu): Boolean {
    addedItems.clear()
    items.forEachIndexed { index, item ->
      addedItems[menu.add(Menu.NONE, Menu.NONE, index, item.title)] = item
    }
    return true
  }

  override fun onPrepareActionMode(mode: ActionMode, menu: Menu): Boolean = false

  override fun onActionItemClicked(mode: ActionMode, menuItem: MenuItem): Boolean {
    val item = addedItems[menuItem] ?: return false
    val start = minOf(view.selectionStart, view.selectionEnd)
    val end = maxOf(view.selectionStart, view.selectionEnd)
    val text = view.text
    if (text != null && start >= 0 && end <= text.length) {
      val reactContext = view.context as ReactContext
      UIManagerHelper.getEventDispatcherForReactTag(reactContext, view.id)
          ?.dispatchEvent(
              SelectionMenuItemPressEvent(
                  UIManagerHelper.getSurfaceId(view),
                  view.id,
                  item.id,
                  text.subSequence(start, end).toString(),
                  start,
                  end,
              )
          )
    }
    // Finishing the action mode also collapses the selection.
    mode.finish()
    return true
  }

  override fun onDestroyActionMode(mode: ActionMode) {
    addedItems.clear()
  }
}

internal class SelectionMenuItemPressEvent(
    surfaceId: Int,
    viewTag: Int,
    private val itemId: String,
    private val selectedText: String,
    private val start: Int,
    private val end: Int,
) : Event<SelectionMenuItemPressEvent>(surfaceId, viewTag) {
  override fun getEventName(): String = EVENT_NAME

  override fun canCoalesce(): Boolean = false

  override fun getEventData(): WritableMap =
      Arguments.createMap().apply {
        putString("id", itemId)
        putString("selectedText", selectedText)
        putInt("start", start)
        putInt("end", end)
      }

  companion object {
    const val EVENT_NAME: String = "topSelectionMenuItemPress"
  }
}
