// ==UserScript== 
// @name          PwdHash
// @namespace     PwdHash_GM
// @description   Automatically generates per-site passwords if you prefix your password with @@ or F2. Based on Stanford PwdHash (https://pwdhash.github.io/website/), migrated to GreaseMonkey and PBKDF2-SHA256 support, based on https://www.cl.cam.ac.uk/%7Edl551/pwdhash/.
// @require       https://gitcdn.link/repo/GWuk/MonkeyConfig/master/monkeyconfig.js
// @require       https://gitcdn.link/repo/GWuk/pwdhash-firefox/master/chrome/content/md5.js
// @require       https://gitcdn.link/repo/GWuk/forge-dist/master/dist/forge.min.js
// @require       https://gitcdn.link/repo/GWuk/pwdhash-firefox/master/chrome/content/domain-extractor.js
// @require       https://gitcdn.link/repo/GWuk/pwdhash-firefox/master/chrome/content/hashed-password.js
// @require       https://gist.githubusercontent.com/GWuk/70ec44fb092534c208533fe51fd3c0c0/raw/44fff2cb77eaff3e4937f372a4a4f7a8fd92c128/stanford-pwdhash.js
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_addStyle
// @grant         GM_registerMenuCommand
// @include       *://*
// @exclude       *://*.sparkasse.at/*
// @version       1.0
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
