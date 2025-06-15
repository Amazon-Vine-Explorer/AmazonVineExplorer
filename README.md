# Amazon Vine Explorer

Makes the Amazon Vine Website even a bit better

![](vine_logo_notification_image.png)

## Description:

This script enhances the experience on the Amazon Vine website. However, it does not provide you with unfair and unintended advantages over other Vine Voices. For example, there will be no automated ordering based on keywords or price! We aim to operate 100% in compliance with the terms and conditions of Amazon Vine using this script.

## How to install:

* Install Tampermonkey: [https://www.tampermonkey.net/](https://www.tampermonkey.net/)
* Install Amazon Vine Explorer: [https://github.com/deburau/AmazonVineExplorer/raw/main/VineExplorer.user.js](https://github.com/deburau/AmazonVineExplorer/raw/main/VineExplorer.user.js)

## Notice:
The Script has currently some issues processing the Tax Value.
We are aware of the issue and are working on a fix.

## Changelog Deburau

##### [2025-06-15] - Version 0.11.20
*  Fixed more errors introduced by ai refactoring.

##### [2025-06-15] - Version 0.11.19
*  Fast scan did not stop in 0.11.18.

##### [2025-06-15] - Version 0.11.18
*  Code cleanup and fixing errors.

##### [2025-06-14] - Version 0.11.17
*  Search box is smaller to avoid wrapping for portrait monitors.
*  The old "Not Seen Max Count" setting is replaced by the new "Number of hours to wait" setting.

##### [2025-06-10] - Version 0.11.16
*  Removed unused (at least by me) files.
*  Make @require's relative.
*  Fix some eslint warnings.
*  The max page number now is computed for every page to scan. This fixes some wierd errors which can lead to cleaning up too many items.
*  The idle period between scans can now be configured.
*  Display time until next scan instead of time since last scan.
*  Fix error message in console log while openening the database.
*  Code refactorings to use async/await.

##### [2025-06-06] - Version 0.11.15
*  The product pages ("Für Sie empfohlen", "Verfügbar für alle" and "Zusätzliche Artikel") now always show the time it was first seen because time of last seen is always the current time.

##### [2025-05-31] - Version 0.11.14
*  Order of items shown on product sites now depends on the setting of "Show first seen instead of last seen".

##### [2025-05-31] - Version 0.11.13
*  Fix: Product not seen counter was not reset when a product was seen again during a scan.

##### [2025-05-30] - Version 0.11.12
*  Show page numbers from 1 to max instead of 0 to max - 1.

##### [2025-05-30] - Version 0.11.11
*  Re-apply Fix left side buttons (Merge pull request #15 from adripo).
*  Fix side buttons vertical distance.

##### [2025-05-29] - Version 0.11.10
*  Revert Fix left side buttons (Merge pull request #15 from adripo).

##### [2025-05-29] - Version 0.11.9
*  Fix: iframe loads only when necessary (Merge pull request #16 from adripo).

##### [2025-05-29] - Version 0.11.8
*  Fix left side buttons (Merge pull request #15 from adripo).

##### [2025-05-27] - Version 0.11.7
*  Show formatted time for Background Scanner Time Waiting (Merge pull request #12 from adripo).

##### [2025-05-27] - Version 0.11.6
*  Enable match for all vine countries (Merge pull request #11 from adripo).

##### [2025-05-27] - Version 0.11.5
*  Items are sorted descending by time last seen (Merge pull request #10 from Olum-hack).

##### [2025-03-21] - Version 0.11.4
*  Fix button height after changes on the vine site.

##### [2025-03-18] - Version 0.11.3
*  Olum found the reason (or at leat one of them) for getting temporarily blocked: fetching the estimated tax price for items with variants.  
   As a workaround, this was removed with the consequence, that estimated tax prices are not shown for this items.

##### [2024-11-22] - Version 0.11.2
*  A value of 0 for "Desktop Notifikation Delay (Seconds)" disables those notifications. This does not disable notifications for item matches.
*  Up to now, database cleanup started after one day after an item was last seen for potluck items and after 7 days for other items.
   Now it starts after the time of the last cleanup.
*  New configuration button "Show first seen instead of last seen". Instead of the "Last seen" date in the product box show the date, the item was first seen.
*  Tax price is displayed with current locale and two fraction digits.
*  Bug fix: if the number of last page to scan is a multiple of 100, an exception was thrown and the scan was aborted.

##### [2024-11-10] - Version 0.11.1
*  Simpler regular expressions for Amazon domain detection
*  Don't announce that this is the master session on none vine pages
*  Removed "Deburau Development Fork" from branding text.
   Be aware that you have to reinstall the script and remove the old one

##### [2024-11-04] - Version 0.11.0
*  Make it possible to edit the MaxItemsPerPage variable. Change contributed by Olum-hack.
*  Bumped version number from 0.10.9.0.1.deburau.18 to 0.11.0

##### [2024-10-09] - Version 0.10.9.0.1.deburau.18
* Every five minues AVE performs a fast scan. That means, potluck and last_chance are scanned and then
  encore until three consecutive pages without new products are found.

##### [2024-09-30] - Version 0.10.9.0.1.deburau.17
* Not Seen Max Count is configurable in AVE settings

##### [2024-09-19] - Version 0.10.9.0.1.deburau.16
* The database cleanup now happens right after a complete scan is finished. Prior to this change,
  the cleanup was performed after waiting for three hours, just before a new scan was started
* Add missing SECONDS_PER_WEEK to globals.js, fixes database cleanup not working.

  After the upgrade, it needs six completed background scans until old entries get deleted. Each
  scan needs about one to two hours plus three hours delay until the next scan starts. This sums
  up to one to two days until cleaning up old entries effectivly starts

##### [2024-09-18] - Version 0.10.9.0.1.deburau.15
* An alert notification is show after product data import finished
* Restart background scan after import finished

##### [2024-09-16] - Version 0.10.9.0.1.deburau.14
* Desktop notifications for products with keyword matches now open the Amazon product page

##### [2024-09-14] - Version 0.10.9.0.1.deburau.13
* Included pull request #41 from DeMoehn from original repo

##### [2024-09-09] - Version 0.10.9.0.1.deburau.12
* Multiple desktop notification keywords can be entered seperated by new lines
* BREAKING CHANGE: Database Import now clears the database prior to importing new data
* Command for database merging is removed

##### [2024-09-08] - Version 0.10.9.0.1.deburau.11
* When the enter key is pressed in the search bar, the search is executed immediately instead of waiting for the input timeout 
* The search bar input delay was increased to 500 milliseconds

##### [2024-09-03] - Version 0.10.9.0.1.deburau.10
* New command **DATABASE MERGE +++** in AVE Settings. It reads a database export and merges it into the existing database.
  New entrires are added, existing entries are overwritten. This differs from **DATABASE IMPORT <<<**, where existing entries are skipped.

##### [2024-08-28] - Version 0.10.9.0.1.deburau.9
* Defaults for **BackGroundScanDelayPerPage** and **BackGroundScannerRandomness** set to 6000

##### [2024-08-28] - Version 0.10.9.0.1.deburau.8
* When upgrading from a former database version, a check for duplicate ASINs is performed. This check fails for newly created databases with the error message
  `Something was going wrong while init database` and `DB_HANDLER.#getStore: Database Object is not defined`
  Now this check is only performed for upgrading existing databases

##### [2024-08-19] - Version 0.10.9.0.1.deburau.7
* The field "id" is used as thè primary key of the IndexedDB database. Unfortunatly it may change over
  time. This often ruslts in errors like this, because the data_asin stays constant even if the id changes.:
  `vine-items:1 Uncaught (in promise) DB_HANDLER.add(): ConstraintError: Unable to add key to index 'data_asin': at least one key does not satisfy the uniqueness requirements.`
  Now it tries to get the object first with the ID an if not found, try with the ASIN

##### [2024-08-16] - Version 0.10.9.0.1.deburau.6
* Search Bar Input Delay is now configurable

##### [2024-08-16] - Version 0.10.9.0.1.deburau.5
* Recently my IP address was temporarely blocked several times by amazon, visiting the vine site 
  returned status 503. So I raised the default for "Background Scan Per Page Min Delay(Milliseconds)"
  to 10.000 and the maximal possible value to 20.000

##### [2024-08-15] - Version 0.10.9.0.1.deburau.4
* Use ESLint and fix errors in requestProductDetails

##### [2024-08-05] - Version 0.10.9.0.1.deburau.3
* Incorporated changes from Olum (see further down)

##### [2024-08-05] - Version 0.10.9.0.1.deburau.2
* Enhancements
  - Mark all seen now only updates new products, not all products
  - Desktop notifications for products with keyword matches now open the
    Amazon product page
    
##### [2024-08-05] - Version 0.10.9.0.1.deburau.1
* Enhancements
  - isNew and isFav are now indexed. Since IndexedDB does not support 
	booleans as index, the type was changed to integer 0 and 1
* New Features
  - Desktop Notification Highlight Keywords can now be JavaScript regular
    expressions. If a keyword has the form _/\<regular expression\>/\<flags\>_,
	it is treated as a regular expression. For instance, if you want get
	notified for new SSD products, you can use the keyword _/\bssd\b/_
	and get only notified for products with "ssd" in the description, but not
	the word "crossdressed"
* Bugfixes
  - notifications are only sent once per product. Fixes #18

### Changelog Olum
##### [2024-08-04] - Version O_5
* Anzeige wann das Produkt das letzte Mal vom Scanner gefunden wurde
  
##### [2024-06-28] - Version O_4
* Background sanner stops for 3 hours after full scan
* Background sanner starts at page 0 after 10 hours
* Show status of background scanner active page / max page
* New Button for "Mark all as seen" -> Enable Button Mark all as seen
  
### Changelog Orginal
[https://github.com/Amazon-Vine-Explorer/AmazonVineExplorer](https://github.com/Amazon-Vine-Explorer/AmazonVineExplorer)
##### [28.06.2024] - Version 0.10.9.0.1
* Little Bugfix to work with an external Partner

##### [28.06.2024] - Version 0.10.9
* Added ability to Share Vine Items, that opens directly on Vine

##### [23.05.2024] - Version 0.10.8.8
* Disabled the Manual Scan due to Bugs

##### [12.05.2024] - Version 0.10.8.7
* Changed minimum required Symbols in Search Field from 3 to 2

##### [09.05.2024] - Version 0.10.8.6
* Changed some Code due to @require loading in Violentmonkey

##### [09.05.2024] - Version 0.10.8.5
* Changed functionality of the "mark as read" Button on the bottom of the Page https://github.com/Amazon-Vine-Explorer/AmazonVineExplorer/issues/28

##### [09.05.2024] - Version 0.10.8.4
* Added external Resource to Fix Amazon Loading Bug

##### [18.03.2024] - Version 0.10.8.3
* Merged https://github.com/Amazon-Vine-Explorer/AmazonVineExplorer/pull/31 (Changed Resource to readable GitHub Source)

##### [18.03.2024] - Version 0.10.8.2
* Added: Added Closing Button on Branding on hover. Fixing https://github.com/Amazon-Vine-Explorer/AmazonVineExplorer/issues/19

##### [25.02.2024] - Version 0.10.8.1
* Bugfix: Disabled the Tax Scan due to issues fetching the value

##### [22.02.2024] - Version 0.10.8
* Bugfix: Next Page Button is now diasbled on last page, also changed the Text to make it more comapct (maybe changeable in the Settings later)

##### [14.02.2024] - Version 0.10.7
* Added: Ability to hide Amazon Categories
* Bugfix: Object "Skip to Main Content" Button in Navbar was not hidden

##### [13.02.2024] - Version 0.10.6
* Added: Ability to hide Amazon Navbar

##### [10.02.2024] - Version 0.10.5
* Added: DarkMode (AVE Settings Menu)

##### [10.12.2023] - Version 0.10.4
* Added: Support for amazon.co.uk
* Change: Changed website detection to be able to handle double dot domain names like amazon.co.uk

##### [28.01.2024] - Version 0.10.3.8
* BugFix: Fixed Bug where only lower letters would work in the SearchBar
* BugFix: Outdated Products didn't increase the notSeenCounter while Database Cleanup
* BugFix: Products got removed by db cleanup because the timespamp check was wrong
* BugFix: LastSeen Timestanp got not saved if Product was existing in Database

##### [11.12.2023] - Version 0.10.3.1
* Update TaxValue in Tile after opend details

##### [10.12.2023] - Version 0.10.3
* Added: Show of TaxInfoPrize inside Tileview
* BugFix: Fixed the bug that Backgroundscan didn´t request Taxdata correctly
* Added: Faster Product Removement if querry returns 'ITEM_NOT_IN_ENROLLMENT' except Favorites
* BugFix: Backgroundscan didn´t restore last state and begun at 0 each time

##### [09.12.2023] - Version 0.10.2.1
* BugFix: Fixed Endlessloop when changing from empty Potluck page to AVE internal page

##### [08.12.2023] - Version 0.10.2
* BugFix: Multiple Querrys after pressing More Details Button
* Improved reliability of Databae Cleanup
* PutLuck Products get removed from Database after one day now
* Added more Master Slave Session detection handling
* Added dead Sessions removement

##### [08.12.2023] - Version 0.10.0

* Changed DB_HANDLER from Callbacks to Promises
* BugFix: Tile Processing was faster then tile loading from Amazon => Added delayloop until all tiles are loaded
* Changed Tile Processor to Promises to increase reliability
* Added Button Colors to Usersettings
* Added the possibility to delete the database (USERSETTINGS)
* Added the possibility to export the database (USERSETTINGS)
* Added the possibility to import the database (USERSETTINGS)
* First Implementation of a Session Detection - Distinguishable by the branding in the bottom left
* Background Scan will not start if Session is not the Master Session
* BugFix: addTileEventhandlers() tryed to place favStar EventHandler to early, not we will wait until Star is there.
* Performance Improvement: Only search for keywords on New Products if there is at least one configured
* User Settings Menu. Schow Name of Setting as tooltip if noe description is set.

##### [06.12.2023] - Version 0.9.0

* Improved Search function to allow multiple keywords
* More improvemnts in the background for faster datahandling, renamed a few variables to fit to new shorthand name AVE, etc.
* Added Usersettings Page, and did a lot of stuff related to this.
* Added Back to Top Button on all subpages.

##### [04.12.2023] - Version 0.8.0

* Added Desktop Notifications
* Added the All Products Button for infinite scroll thru all the vine products
* The New Products Button shows the amount of new products
* Added new Button to left Side to set ALL Products to !isNew
* Added Indicators (left bottom corner) who shows Database aktivity, Database cleanup and Backgroundscan aktivity
* Added more Randomness for Backgroundscanner. Default Delay (4S) + 0-4S Per Dataquerry from Amazon
* Changed Database function for querry all entrys to increse the performance of this function
* Added "controlled delay" (Observer) to be safe for querry product tile elements (sometimes the parser was to fast and tryed to read not existing elements)
* Added function to querry product details from amazon and merge it with product database element
* Added Product Details Fetch to Backgroundscan
* a few little bugfixes

##### [01.12.2023] - Version 0.7.1

* A lot of Stuff will work, lets call it the initial version

##### [24.11.2023] - Version 0.1

* Start of this Project

