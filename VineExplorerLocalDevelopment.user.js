// ==UserScript==
// @name         Amazon Vine Explorer - Local Development
// @namespace    http://tampermonkey.net/
// @version      9.9.9
// @description  Better View and Search and Explore for Vine Products - Vine Voices Edition
// @author       MarkusSR1984
// @match        *://www.amazon.de/*
// @match        *://www.amazon.com/*
// @license      MIT
// @icon         https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/main/vine_logo.png
// @run-at       document-start
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.xmlHttpRequest
// @grant        GM.openInTab
// @grant        unsafeWindow
//-------------------------------------//
// Since TamperMonkey can't access local files any more, use a tiny Nginx all-in-one web server app
// bundle to serve up the files as HTTP from localhost
//    https://github.com/r3c/winp
//-------------------------------------
// @require      http://127.0.0.1/globals.js
// @require      http://127.0.0.1/class_product.js
// @require      http://127.0.0.1/class_db_handler.js
// @require      http://127.0.0.1/VineExplorer.user.js
// @require      http://127.0.0.1/translations.js
// ==/UserScript==

/**
 * Zuerst muss Tampermonkey das recht gegeben werden auf lokale Dateien zugreifen zu dürfen:
 * - Abhängig voneurem Browser ind die Erweiterungsverwaltung gehen
 * - Bei Tampermonkey auf Details klicken
 * - Auf der Seite die Option "Zugriff auf Datei-URLs zulassen" aktivieren
 * 
 * Dieses Template als eigenes script in Tampermonkey hinzufügen oder mit dem link istallieren
 * - https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/dev-main/VineExplorerLocalDevelopment.user.js
 * - Die Pfade der Dateien bei @require and eure localen Pfade anpassen
 * 
 * NICHT VERGESSEN die Onlineversion deaktivieren wenn ihr mit dieser arbeitet
 * 
 * Die @grant Einstellungen immer gegenchecken, da die Header des Hauptscripts nicht beachtet werden und Tampermonkey nur die hier gesetzten Optionen verwendet
 * 
 * Vorteil: Lokale Dateiänderungen werden sofort nach Websitereload angewendet, das macht das entwickeln leichter und effektiver
 */

