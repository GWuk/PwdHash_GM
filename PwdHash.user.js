// ==UserScript== 
// @name          PwdHash
// @namespace     PwdHash_GM
// @description   Automatically generates per-site passwords if you prefix your password with @@ or F2. Based on Stanford PwdHash (https://pwdhash.github.io/website/), migrated to GreaseMonkey and PBKDF2-SHA256 support, based on https://www.cl.cam.ac.uk/%7Edl551/pwdhash/.
// @require       https://raw.githubusercontent.com/GWuk/PwdHash_GM/master/monkeyconfig.js
// @require       https://raw.githubusercontent.com/GWuk/PwdHash_GM/master/md5.js
// @require       https://raw.githubusercontent.com/GWuk/PwdHash_GM/master/forge.min.js
// @require       https://raw.githubusercontent.com/GWuk/PwdHash_GM/master/domain-extractor.js
// @require       https://raw.githubusercontent.com/GWuk/PwdHash_GM/master/hashed-password.js
// @require       https://raw.githubusercontent.com/GWuk/PwdHash_GM/master/stanford-pwdhash.js
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_addStyle
// @grant         GM_registerMenuCommand
// @noframes
// @include       *://*
// @exclude       *://*.sparkasse.at/*
// @version       1.2
// ==/UserScript== 

// http://odyniec.net/projects/monkeyconfig/usage.html
var cfg = new MonkeyConfig({
    title: 'PwdHash Configuration',
    menuCommand: true,
    buttons:  [ "save", "cancel" ],
    params: {
        salt: {
            type: 'text',
            default: ''
        },
        iterations: {
            type: 'number',
            default: 10000
        },
        legacy: {
            type: 'checkbox',
            default: true
        }
    }
});

SPH_salt = cfg.get('salt');
SPH_iterations = cfg.get('iterations');
SPH_legacy = cfg.get('legacy');

SPH_init();
