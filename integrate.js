/*
 * Copyright 2016 Jiří Janoušek <janousek.jiri@gmail.com>
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

"use strict";

(function(Nuvola)
{

// Create media player component
var player = Nuvola.$object(Nuvola.MediaPlayer);

// Handy aliases
var PlaybackState = Nuvola.PlaybackState;
var PlayerAction = Nuvola.PlayerAction;

// SiriusXM Control Buttons
var Buttons= {
    PLAY: "play",
    PAUSE: "pause",
    PREV_SONG: "rewind",
    NEXT_SONG: "skip"
}

// Create new WebApp prototype
var WebApp = Nuvola.$WebApp();

// Initialization routines
WebApp._onInitWebWorker = function(emitter)
{
    Nuvola.WebApp._onInitWebWorker.call(this, emitter);

    var state = document.readyState;
    if (state === "interactive" || state === "complete")
        this._onPageReady();
    else
        document.addEventListener("DOMContentLoaded", this._onPageReady.bind(this));
}

// Page is ready for magic
WebApp._onPageReady = function()
{
    // Connect handler for signal ActionActivated
    Nuvola.actions.connect("ActionActivated", this);

    // Start update routine
    this.update();
}

function getElmText(selector)
{
    var elm = document.querySelector(selector);
    return elm ? elm.innerText.trim() || null : null;
}

// Extract data from the web page
WebApp.update = function()
{
    var track = {
        title: null,
        artist: null,
        album: null,
        artLocation: null,
        rating: null
    }
    
    /* Hide the mini-player button as it's broken in Nuvola. */
    var elm = document.querySelector("#player div.pop-out");
    if (elm)
        elm.style.visibility = "hidden";
    
    /* Parse track metadata */
    track.title = getElmText("#player p[ng-show='model.showTrackName']");
    if (!track.title)
        track.title = getElmText("#player p[ng-show='model.showShowName']");
    track.artist = getElmText("#player p[ng-show='model.showArtistName']");
    
    /* Album art has restricted access and only NP >= 3.1 is able to fetch it via the WebKit's NetworkProcess.  */
    var elm = Nuvola.VERSION >= 30100 ? document.querySelector("div.np-track-art img") : null;
    if (elm && elm.src != "https://player.siriusxm.com/assets/images/Transparent.gif" && elm.src != "assets/images/Transparent.gif")
    {
        track.artLocation = elm.src;
    }
    else
    {
       elm = document.querySelector("div.now-playing-image img");
       if (elm)
            track.artLocation = elm.src;
    }
    player.setTrack(track);
    
    /* Parse controls */
    var state;
    if (this._getButton(Buttons.PLAY))
    {
        state = PlaybackState.PAUSED;
        player.setCanPlay(true);
        player.setCanPause(false);
    }
    else if (this._getButton(Buttons.PAUSE))
    {
        state = PlaybackState.PLAYING;
        player.setCanPause(true);
        player.setCanPlay(false);
    }
    else
    {
        state = PlaybackState.UNKNOWN;
        player.setCanPause(false);
        player.setCanPlay(false);
    }
    player.setCanGoPrev(!!this._getButton(Buttons.PREV_SONG));
    player.setCanGoNext(!!this._getButton(Buttons.NEXT_SONG));
    player.setPlaybackState(state);

    // Schedule the next update
    setTimeout(this.update.bind(this), 500);
}

WebApp._getButton = function(action)
{
    var elm = document.querySelector(".scrub-controls div[ng-click='" + action + "()']");
    return elm && !elm.classList.contains("ng-hide") ? elm : false;
}

WebApp._clickButton = function(action)
{
    var btn = this._getButton(action)
    if (btn)
    {
        Nuvola.clickOnElement(btn);
        return true;
    }
    return false;
}

// Handler of playback actions
WebApp._onActionActivated = function(emitter, name, param)
{
    switch (name)
    {
    case PlayerAction.TOGGLE_PLAY:
        if (!WebApp._clickButton(Buttons.PAUSE))
            WebApp._clickButton(Buttons.PLAY);
        break;
    case PlayerAction.PLAY:
        WebApp._clickButton(Buttons.PLAY);
        break;
    case PlayerAction.PAUSE:
    case PlayerAction.STOP:
        WebApp._clickButton(Buttons.PAUSE);
        break;
    case PlayerAction.PREV_SONG:
        WebApp._clickButton(Buttons.PREV_SONG);
        break;
    case PlayerAction.NEXT_SONG:
        WebApp._clickButton(Buttons.NEXT_SONG);
        break;
    }
}

WebApp.start();

})(this);  // function(Nuvola)
