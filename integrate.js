/*
 * Copyright 2016-2019 Jiří Janoušek <janousek.jiri@gmail.com>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

(function (Nuvola) {
  var _ = Nuvola.Translate.gettext
  var C_ = Nuvola.Translate.pgettext

  var COUNTRY_VARIANT = 'app.country_variant'
  var HOME_PAGE = 'https://player.siriusxm.{1}/'
  var COUNTRY_VARIANTS = [
    ['com', C_('Sirius variant', 'United States')],
    ['ca', C_('Sirius variant', 'Canada')]
  ]

  var player = Nuvola.$object(Nuvola.MediaPlayer)

  var PlaybackState = Nuvola.PlaybackState
  var PlayerAction = Nuvola.PlayerAction

  var WebApp = Nuvola.$WebApp()

  WebApp._onInitAppRunner = function (emitter) {
    Nuvola.config.setDefault(COUNTRY_VARIANT, 'com')
    Nuvola.core.connect('InitializationForm', this)
    Nuvola.core.connect('PreferencesForm', this)
    Nuvola.config.connect('ConfigChanged', this)
  }

  WebApp._onInitializationForm = function (emitter, values, entries) {
    if (Nuvola.config.hasKey(COUNTRY_VARIANT)) {
      var variant = Nuvola.config.get(COUNTRY_VARIANT)
      for (var entry of COUNTRY_VARIANTS) {
        if (entry[0] === variant) {
          return
        }
      }
    }
    Nuvola.config.set(this.LAST_URI, null)
    this.appendPreferences(values, entries)
  }

  WebApp._onPreferencesForm = function (emitter, values, entries) {
    this.appendPreferences(values, entries)
  }

  WebApp.appendPreferences = function (values, entries) {
    values[COUNTRY_VARIANT] = Nuvola.config.get(COUNTRY_VARIANT)
    entries.push(['header', _('Sirius XM')])
    entries.push(['label', _('National variant')])
    for (var i = 0; i < COUNTRY_VARIANTS.length; i++) {
      entries.push(['option', COUNTRY_VARIANT, COUNTRY_VARIANTS[i][0], COUNTRY_VARIANTS[i][1]])
    }
  }

  WebApp._onHomePageRequest = function (emitter, result) {
    result.url = Nuvola.format(HOME_PAGE, Nuvola.config.get(COUNTRY_VARIANT))
  }

  WebApp._onConfigChanged = function (emitter, key) {
    Nuvola.log('ehm _onConfigChanged {1} {2}', key, Nuvola.config.get(key))
    if (key === COUNTRY_VARIANT) {
      Nuvola.config.set(this.LAST_URI, null)
      Nuvola.actions.activate(Nuvola.BrowserAction.GO_HOME)
    }
  }

  WebApp._onInitWebWorker = function (emitter) {
    Nuvola.WebApp._onInitWebWorker.call(this, emitter)

    var state = document.readyState
    if (state === 'interactive' || state === 'complete') {
      this._onPageReady()
    } else {
      document.addEventListener('DOMContentLoaded', this._onPageReady.bind(this))
    }
  }

  WebApp._onPageReady = function () {
    Nuvola.actions.connect('ActionActivated', this)
    this.update()
  }

  WebApp.update = function () {
    var track = {
      title: Nuvola.queryText('player-controls program-descriptive-text .track-name'),
      artist: Nuvola.queryText('player-controls program-descriptive-text .artist-name'),
      album: null,
      artLocation: Nuvola.queryAttribute('player-controls program-descriptive-text img.channel-image', 'src'),
      rating: null
    }
    player.setTrack(track)

    var elms = this._getElements()
    var state
    if (elms.play) {
      state = PlaybackState.PAUSED
    } else if (elms.pause) {
      state = PlaybackState.PLAYING
    } else {
      state = PlaybackState.UNKNOWN
    }

    player.setCanPlay(!!elms.play)
    player.setCanPause(!!elms.pause)
    player.setCanGoPrev(!!elms.prev)
    player.setCanGoNext(!!elms.next)
    player.setPlaybackState(state)

    player.updateVolume(Nuvola.queryText('player-controls .volume-bar .volume-hidden', (value) => value / 100))
    player.setCanChangeVolume(elms.volume && elms.volumeSlider)

    // Schedule the next update
    setTimeout(this.update.bind(this), 500)
  }

  WebApp._clickButton = function (btn) {
    if (btn) {
      Nuvola.clickOnElement(btn)
      return true
    }
    return false
  }

  WebApp._getElements = function () {
    var elms = {
      play: document.querySelector('player-controls .play-pause-btn'),
      pause: null,
      prev: document.querySelector('player-controls .skip-back-btn'),
      next: document.querySelector('player-controls .skip-forward-btn'),
      volume: document.querySelector('player-controls .volume-button'),
      volumeBar: document.querySelector('player-controls .volume-bar'),
      volumeSlider: document.querySelector('player-controls input.volume-bar--slider')
    }
    for (var key in elms) {
      if (elms[key] && elms[key].parentNode.classList.contains('visibility-hidden')) {
        elms[key] = null
      }
    }
    if (elms.play) {
      var img = elms.play.querySelector('img')
      if (img && img.src.includes('pause')) {
        elms.pause = elms.play
        elms.play = null
      }
    }
    return elms
  }

  // Handler of playback actions
  WebApp._onActionActivated = function (emitter, name, param) {
    var elms = this._getElements()
    switch (name) {
      case PlayerAction.TOGGLE_PLAY:
        if (!this._clickButton(elms.pause)) {
          this._clickButton(elms.play)
        }
        break
      case PlayerAction.PLAY:
        this._clickButton(elms.play)
        break
      case PlayerAction.PAUSE:
      case PlayerAction.STOP:
        this._clickButton(elms.pause)
        break
      case PlayerAction.PREV_SONG:
        this._clickButton(elms.prev)
        break
      case PlayerAction.NEXT_SONG:
        this._clickButton(elms.next)
        break
      case PlayerAction.CHANGE_VOLUME:
        if (elms.volumeSlider) {
          elms.volumeBar.removeAttribute('hidden')
          Nuvola.setInputValueWithEvent(elms.volumeSlider, param * 100)
          elms.volumeBar.setAttribute('hidden', true)
        }
        break
    }
  }

  WebApp.start()
})(this) // function (Nuvola)
