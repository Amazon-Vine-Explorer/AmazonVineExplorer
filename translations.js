'use strict';
console.log('translations.js script execution started');
console.log(`DISPLAY_LANGUAGE is ${DISPLAY_LANGUAGE}`);

if (DISPLAY_LANGUAGE === 'en') {
    console.log('Loading English language');
    TRANSLATION = {
         mrkAllSeenBtn       : "Mark All Seen"
        ,mrkCurrPgSeenBtn    : "Mark Current Page Seen"
        ,allItemsBtn         : "All Items"
        ,backToTopBtn        : "Goto Top"
        ,next                : "Next"
        ,nothingToSee        : "Nothing to see here"
        ,notYet              : "At least not yet :P"
        ,newItems            : "New Items"
        ,prodDetails         : "Item Details"
        ,favorites           : "Favorites"
        ,read                : "Read"
        ,taxAmt              : "Tax Amt"
        ,settings            : "AVE Settings"
        ,searchVineProducts  : "Search Vine Products In Local DB"
        ,results             : "results"
        ,displayingResultsOf : "of"
        ,displayingResults   : "Viewing"
    };
} else if (DISPLAY_LANGUAGE === 'de') {
    console.log('Loading German language');
    TRANSLATION = {
         mrkAllSeenBtn       : "Alle als gesehen markieren"
        ,mrkCurrPgSeenBtn    : "Aktuelle Seite als gesehen markieren"
        ,allItemsBtn         : "Alle Produkte"
        ,backToTopBtn        : "Zum Seitenanfang"
        ,next                : "Nächste"
        ,nothingToSee        : "Hier gibt es nix zu sehen"
        ,notYet              : "Zumindest noch nicht :P"
        ,newItems            : "Neue Einträge"
        ,prodDetails         : "Weitere Details"
        ,favorites           : "Favoriten"
        ,read                : "Gelesen"
        ,taxAmt              : "Tax Prize"
        ,settings            : "AVE Einstellungen"
        ,searchVineProducts  : "Suche Vine Produkte in Lokaler Datenbank"
        ,results             : "Ergebnissen"
        ,displayingResultsOf : "von"
        ,displayingResults   : "Anzeigen von"
    };

} else {
    console.log('Loading DEFAULT UNKNOWN language');
    console.log('No matching value found in translations.js file');
    TRANSLATION = {
         mrkAllSeenBtn       : "_Mark All Seen"
        ,mrkCurrPgSeenBtn    : "_Mark Current Page Seen"
        ,allItemsBtn         : "_All Items"
        ,backToTopBtn        : "_Goto Top"
        ,next                : "_Next"
        ,nothingToSee        : "_Nothing to see here"
        ,notYet              : "_At least not yet :P"
        ,newItems            : "_New Items"
        ,prodDetails         : "_Item Details"
        ,favorites           : "_Favorites"
        ,read                : "_Read"
        ,taxAmt              : "_Tax Amt"
        ,settings            : "_AVE Settings"
        ,searchVineProducts  : "_Search Vine Products"
        ,results             : "_results"
        ,displayingResultsOf : "_of"
        ,displayingResults   : "_Viewing"
    };

}

console.log("TRANSLATION: %o", TRANSLATION)
console.log('translations.js script execution completed');
