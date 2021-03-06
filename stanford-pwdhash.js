/*

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
    * Neither the name of Stanford University nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

*/
// A Firefox version of PwdHash. 
// Allows users to invisibly generate site-specific passwords.
//
// Author: Collin Jackson
// Other contributors: Blake Ross, Nick Miyake, Dan Boneh, John Mitchell
//
// This version actually does the key masking trick (unlike my previous
// Firefox prototype, which disabled JavaScript). It makes hashed
// passwords that are as long as the user's original password (including
// the prefix), which is information that we are leaking to the website
// anyway. I'm also looking at the user's password for hints as to
// whether nonalphanumerics are okay. Users who prefer the password key
// (F2) will see a small character increase in password size when they
// leave the field. Otherwise, I've stripped out all graphical user
// interface; it's completely invisible unless it detects that something
// goes wrong.

//
// Major TODOs: 
// Collaborate with Mozilla Foundation to solve Flash keystroke stealing
// Put in some better defenses for focus stealing attacks
// Config file


//////////////////////////////////////////////////////////////////////////////
// Constants

const SPH_kPasswordKey = "DOM_VK_F2";
const SPH_kPasswordPrefix = "@@";
const SPH_kMinimumPasswordSize = 5;  // Our defense against focus stealing
const SPH_AddOnName = "PwdHash";

////////////////////////////////////////////////////////////////////////////
// Debug stuff

/**
 * Dump information to the console?
 */
var SPH_debug = true;

/**
 * Sends data to the console if we're in debug mode
 * @param msg The string containing the message to display
 */
function SPH_dump(msg) {
  if (SPH_debug)
    // console.log("|||||||||| SPH pwdhash: " + msg + "\n");
    console.log(SPH_AddOnName + ": " + msg);
}

////////////////////////////////////////////////////////////////////////////
// "Major" objects/classes

/**
 * Password Key Monitor
 * Watches for the password prefix or password key
 */
function SPH_PasswordKeyMonitor() {
  this.keystream = new Array();
  window.addEventListener("keydown", this, true);
  window.addEventListener("keypress", this, true);
  window.addEventListener("keyup", this, true);
}

SPH_PasswordKeyMonitor.prototype = {

   keystream: null,

   protector: null,

   handleEvent: function(evt) {

     // Detect Password Key
     if (evt.keyCode == evt[SPH_kPasswordKey]) { 
       if (evt.type == "keydown") {
         evt.stopPropagation();   // Don't let user JavaScript see this event
         evt.preventDefault();    // Do not let the character hit the page
         evt.pwdkey = true;
         if (evt.shiftKey) {
           // enable legacy mode on Shift-F2
           SPH_legacyUser = true
           SPH_legacy = true;
           SPH_dump("enabled legacy mode");
           SPH_controller.warnUser(SPH_strings["pwdhash.legacy"]);  
         }
         if (this.attemptPasswordKeyLogin()) {
            SPH_dump("enabled pwdhash on field '" + evt.target.name + "'");
         } else {
            SPH_dump("failed to get pwd field");
         } 
       }
     }

     // Detect Password Prefix
     if (evt.type == "keypress") {
       var lastChar = String.fromCharCode(evt.charCode);
       this.keystream.push(lastChar);

       if (this.keystream.length > SPH_kPasswordPrefix.length)
         this.keystream.shift();
 
       if (!this.protector && 
           this.keystream.join('') == SPH_kPasswordPrefix) {
         evt.alreadyIntercepted = true;  // Don't intercept again
         this.attemptPasswordPrefixLogin(lastChar);

       }
     }
  },

  /**
   * Create a password protector on an appropriate password field
   */
  attemptPasswordKeyLogin: function() { 
    if(this.protector) {  // Already protecting a password field
      this.protector.field.value = "";  // Clear field
      return this.protector;
    }

    // Try the focused field, if it's a password field
    try {
     var element = document.activeElement;
     if (element) { 
       if (element.nodeName == "INPUT" && element.type == "password") {
         element.value = "";  // clear field
         return new SPH_PasswordProtector(element, this);
       }
     }
    } catch(e) {
      SPH_dump(e.message);
    }

    // Try to find a password field on the page and its frames
    try {
     var pwdfields = document.getElementsByTagName('INPUT');
     for (var i = 0; i < pwdfields.length; i++)
       if (pwdfields[i].type == "password") return new SPH_PasswordProtector(pwdfields[i], this);
    } catch(e) {
      SPH_dump(e.message);
    }

        
    // Yikes! Couldn't find any password fields
    var msg = SPH_strings["pwdhash.pwdkeywarn"];
    SPH_controller.warnUser(msg);  
    return null;
  },

  /**
   * Create a password protector on the focused field
   */
  attemptPasswordPrefixLogin: function(lastChar) { 
    if (this.protector) {  // Already protecting a password field
      return this.protector;
    }

    try {
      var element = document.activeElement;
      if (element) { 
        if (element.nodeName == "INPUT" && element.type == "password") {
          if (element.value + lastChar == SPH_kPasswordPrefix) {
            return new SPH_PasswordProtector(element, this);
          }
        }
      }
    } catch(e) {
      SPH_dump(e.message);
    }
      
    var msg = SPH_strings["pwdhash.pwdprefixwarn"];
    SPH_controller.warnUser(msg);     // Couldn't find any password fields
    return null;
  },

  /*
   * Find a password field in the specified frame and return it, 
   * or return null if no such password field exists
   */
  findPasswordField: function(frame) {
    var pwdfields = frame.document.getElementsByTagName('INPUT');
    for (var i = 0; i < pwdfields.length; i++)
      if (pwdfields[i].type == "password") return pwdfields[i];
    var result = null;
    if (frame.frames)
      for (var i = 0; i < frame.frames.length; i++)
        if (!result) result = this.findPasswordField(frame.frames[i]);
    return result;
  },

}

/**
 * Password Protector
 * Records and masks keystrokes while user is in password mode.
 * Triggers hashing when the user is done.
 */
function SPH_PasswordProtector(field, monitor) {

  // check for salt
  if (!SPH_legacy && (SPH_salt == "")) {
    SPH_controller.warnUser(SPH_strings["pwdhash.saltempty"]);      
    field.value = ""
    return null;
  }
 
  this.keyMap = new Array();
  this.nextAvail = this.firstAvail;
  this.field = field;
  this.field.setAttribute("secure","yes");
  this.borderstyle = this.field.style.border;
  this.field.style.border = "2px dashed " + (SPH_legacy ? "red" : "green");
  field.addEventListener("keydown", this, true);
  field.addEventListener("keyup", this, true);
  field.addEventListener("keypress", this, true);
  field.addEventListener("blur", this, true);
  field.addEventListener("focus", this, true);
  field.addEventListener("submit", this, true);
  monitor.protector = this;
  this._disable = function() {
    field.removeEventListener("keydown", this, true);
    field.removeEventListener("keyup", this, true);
    field.removeEventListener("keypress", this, true);
    field.removeEventListener("blur", this, true);
    field.removeEventListener("focus", this, true);
    field.removeEventListener("submit", this, true);
    monitor.protector = null;
  }

}

SPH_PasswordProtector.prototype = {

  firstAvail: 'A'.charCodeAt(0),  // First available mask character

  lastAvail: 127,  // Last available mask character (last printable)

  nextAvail: null,  // The next mask character this protector may use

  keyMap: null,  // A mapping from masked characters to originals

  field: null,  // The field we are protecting
  
  borderstyle: null, // remember previous style

  /**
   * Implementation of eventListener. Remembers keystrokes and watches for blur
   */
  handleEvent: function(evt) {
    if(!evt.pwdkey &&
       evt.originalTarget != this.field && 
       evt.originalTarget != this.field.form) {
      // We're confused; try to avoid messing things up further
      SPH_dump('Unexpected event ' + evt.type + 
                ' on target ' + evt.originalTarget);
      this._disable();
      // TODO: Eventually we should be determining whether it is safe
      // to fail quietly or whether the unexpected event is putting the
      // user at risk
    }

    if(evt.alreadyIntercepted) return; // Ignore self-generated keystrokes

    // We need to make sure the user's printable key events don't leak
    if((evt.type == "keydown" || evt.type == "keyup") &&
       evt.keyCode >= evt.DOM_VK_0 && evt.keyCode <= evt.DOM_VK_DIVIDE) {
      evt.stopPropagation();   // Don't let user JavaScript see this event
    }

    // Printable keystrokes should be masked
    if(evt.type == "keypress") {
      evt.stopPropagation();   // Don't let user JavaScript see this event
      evt.preventDefault();    // Do not let the character hit the page
      evt.originalTarget.value = evt.originalTarget.value + String.fromCharCode(this.mask(evt.charCode));
    }
   
    if (evt.type == "blur" || evt.type == "submit") {
      this.finish();
      // TODO: Check for trusted blur event and call this._warnUntrusted();
    }
  },

  _warnUntrusted: function() {
    this._disable();
    if (this.field) this.field.value = '';
    var msg = SPH_strings["pwdhash.trustedeventwarn"];
    SPH_dump(msg);      // Ideally, use SPH_controller.warnUser(msg);
  },

  /**
   * Translate the masked characters back to the originals
   */
  getPasswordFromMasked: function(masked) {
    var password = "";
    for (var i = 0; i < masked.length; i++) { 
      var current = masked.charCodeAt(i);
      if (this.keyMap[current]) password += String.fromCharCode(this.keyMap[current]);
      else password += masked.substring(i, 1);  // Keeps password from shrinking
    }
    return password;
  },

  /**
   * Remember a keystroke and give me a mask I can use in its place
   */
  mask: function(charCode) {
    this.keyMap[this.nextAvail] = charCode;
    if (this.nextAvail > this.lastAvail) {
      var msg = SPH_strings["pwdhash.longpasswordwarn"];
      SPH_controller.warnUser(msg);  
      this._disable();
    }
    return this.nextAvail++;
  },

  /**
   * When a blur event occurs, we have to hash the field
   */
  finish: function() { 
    this._disable();

    var field = this.field
    var password = field.value;
    if (password == "") {
      field.secure = undefined; // User left field blank
    } else {
      // Trim the initial "@@" password prefix, if any
      var size = SPH_kPasswordPrefix.length;
      if(password.substring(0, size) == SPH_kPasswordPrefix) 
        password = password.substring(size);

      // Enforce minimum size requirement
      if(password.length < SPH_kMinimumPasswordSize) {
        var msg = SPH_strings["pwdhash.shortpasswordwarn"];
        SPH_controller.warnUser(msg);  
        field.value = '';
      } else {      
        // Obtain the hashed password
        var uri = new String(field.ownerDocument.location);
        var domain = (new SPH_DomainExtractor()).extractDomain(uri);
        var unmasked = this.getPasswordFromMasked(password);
        
        // get password (and check for legacy mode)      
        if (SPH_legacy) {
          field.value = (new SPH_HashedPassword_MD5(unmasked, domain));
        } else {
          field.value = (new SPH_HashedPassword(unmasked, domain, SPH_salt, SPH_iterations));
        }
              
        // Clear the field if the user tries to edit the field
        var refocus = function() {
          field.removeEventListener("keydown", refocus, false);
          field.removeEventListener("focus", refocus, false);
          field.value = "";
        }
        field.addEventListener("keydown", refocus, false);
        field.addEventListener("focus", refocus, false);
      }
    }
    
    // restore style
    this.field.style.border = this.borderstyle;
    // reset 
    SPH_legacyUser = false
  },

}

/**
 * Master control object. Just kicks off the key monitor and
 * serves a global warning service
 */
function SPH_Controller(model) {
  this._passwordKeyMonitor = new SPH_PasswordKeyMonitor();
}

SPH_Controller.prototype = {
  warnUser: function(msg) {
    alert(SPH_AddOnName + ": " + msg);
  },

}

// What script would be complete without a couple of globals?
var SPH_controller;
var SPH_strings;
var SPH_salt = "";
var SPH_iterations;
var SPH_legacy = true; // default to legacy mode
var SPH_strings = {};
var SPH_legacyUser = false // user requested legacy mode?

function SPH_getOptions() {
  function onError(error) {
    SPH_dump("Error: ${error}");
  }
  
  function onGot(item) {
    SPH_salt = item.salt;
    SPH_iterations = item.iterations;
    if (!SPH_legacyUser) SPH_legacy = (item.legacy == null ? true : item.legacy)
    //SPH_dump(SPH_salt); 
    //SPH_dump(SPH_iterations); 
    if (SPH_legacy) SPH_dump("legacy = " + SPH_legacy);
  }

  return browser.storage.local.get().then(onGot,onError);

}

function SPH_init() {
  SPH_controller = new SPH_Controller();

  SPH_strings["pwdhash.pwddisplay"]="Hashed password for %s: %s";
  SPH_strings["pwdhash.warningtitle"]="PwdHash Warning";
  SPH_strings["pwdhash.pwdkeywarn"]="PwdHash could not find a password field on this page.\nIt is possible, though unlikely, that the site trying to steal your password.\nDo not enter your PwdHash password into this page.";
  SPH_strings["pwdhash.pwdprefixwarn"]="You typed the PwdHash password prefix, but you are not currently in a password field that starts with the password prefix.\nIt is possible, though unlikely, that the site trying to steal your password.\nDo not enter your PwdHash password into this page.";
  SPH_strings["pwdhash.trustedeventwarn"]="JavaScript on this page may be interfering with your ability to enter a password.\nAs a precaution, the password field has been cleared.\nIf the problem persists, you might not be able to use PwdHash on this page.";
  SPH_strings["pwdhash.longpasswordwarn"]="Your password is too long to protect.";
  SPH_strings["pwdhash.shortpasswordwarn"]="Your password is too short to protect.";
  SPH_strings["pwdhash.saltempty"]="No salt set, you have to set one in Add-On options.";
  SPH_strings["pwdhash.legacy"]="Legacy mode enabled manually, reload page to use mode configured in options";

//  SPH_getOptions()
}

// SPH_init();
