# Amazon Vine Explorer

Makes the Amazon Vine Website even a bit better

![](vine_logo_notification_image.png)

## Description:

This script enhances the experience on the Amazon Vine website. However, it does not provide you with unfair and unintended advantages over other Vine Voices. For example, there will be no automated ordering based on keywords or price! We aim to operate 100% in compliance with the terms and conditions of Amazon Vine using this script.

## How to install:

* Install Tampermonkey: [https://www.tampermonkey.net/](https://www.tampermonkey.net/)
* Install Amazon Vine Explorer: [https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/main/VineExplorer.user.js](https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/main/VineExplorer.user.js)

## Notice:
The Script has currently some issues processing the Tax Value.
We are aware of the issue and are working on a fix.

## Changelog:
<details open>
  <summary>Click mich</summary>
<deatails open>
<summary>##### [23.05.2024] - Version 0.10.8.8</summary>
* Disabled the Manual Scan due to Bugs
</deatails>
<details>
<summary>##### [12.05.2024] - Version 0.10.8.7</summary>
* Changed minimum required Symbols in Search Field from 3 to 2
</details>
<details>
<summary>
##### [09.05.2024] - Version 0.10.8.6</summary>
* Changed some Code due to @require loading in Violentmonkey
</details>
<details>
<summary>
##### [09.05.2024] - Version 0.10.8.5</summary>
* Changed functionality of the "mark as read" Button on the bottom of the Page https://github.com/Amazon-Vine-Explorer/AmazonVineExplorer/issues/28
</details>
<details>
<summary>
##### [09.05.2024] - Version 0.10.8.4</summary>
* Added external Resource to Fix Amazon Loading Bug
</details>
<details>
<summary>
##### [18.03.2024] - Version 0.10.8.3</summary>
* Merged https://github.com/Amazon-Vine-Explorer/AmazonVineExplorer/pull/31 (Changed Resource to readable GitHub Source)
</details>
<details>
<summary>
##### [18.03.2024] - Version 0.10.8.2</summary>
* Added: Added Closing Button on Branding on hover. Fixing https://github.com/Amazon-Vine-Explorer/AmazonVineExplorer/issues/19
</details>
<details>
<summary>
##### [25.02.2024] - Version 0.10.8.1</summary>
* Bugfix: Disabled the Tax Scan due to issues fetching the value
</details>
<details>
<summary>
##### [22.02.2024] - Version 0.10.8</summary>
* Bugfix: Next Page Button is now diasbled on last page, also changed the Text to make it more comapct (maybe changeable in the Settings later)
</details>
<details>
<summary>
##### [14.02.2024] - Version 0.10.7</summary>
* Added: Ability to hide Amazon Categories
* Bugfix: Object "Skip to Main Content" Button in Navbar was not hidden
</details>
<details>
<summary>
##### [13.02.2024] - Version 0.10.6</summary>
* Added: Ability to hide Amazon Navbar
</details>
<details>
<summary>
##### [10.02.2024] - Version 0.10.5</summary>
* Added: DarkMode (AVE Settings Menu)
</details>
<details>
<summary>
##### [10.12.2023] - Version 0.10.4</summary>
* Added: Support for amazon.co.uk
* Change: Changed website detection to be able to handle double dot domain names like amazon.co.uk
</details>
<details>
<summary>
##### [28.01.2024] - Version 0.10.3.8</summary>
* BugFix: Fixed Bug where only lower letters would work in the SearchBar
* BugFix: Outdated Products didn't increase the notSeenCounter while Database Cleanup
* BugFix: Products got removed by db cleanup because the timespamp check was wrong
* BugFix: LastSeen Timestanp got not saved if Product was existing in Database
</details>
<details>
<summary>
##### [11.12.2023] - Version 0.10.3.1</summary>
* Update TaxValue in Tile after opend details
</details>
<details>
<summary>
##### [10.12.2023] - Version 0.10.3</summary>
* Added: Show of TaxInfoPrize inside Tileview
* BugFix: Fixed the bug that Backgroundscan didn´t request Taxdata correctly
* Added: Faster Product Removement if querry returns 'ITEM_NOT_IN_ENROLLMENT' except Favorites
* BugFix: Backgroundscan didn´t restore last state and begun at 0 each time
</details>
<details>
<summary>
##### [09.12.2023] - Version 0.10.2.1</summary>
* BugFix: Fixed Endlessloop when changing from empty Potluck page to AVE internal page
</details>
<details>
<summary>
##### [08.12.2023] - Version 0.10.2</summary>
* BugFix: Multiple Querrys after pressing More Details Button
* Improved reliability of Databae Cleanup
* PutLuck Products get removed from Database after one day now
* Added more Master Slave Session detection handling
* Added dead Sessions removement
</details>
<details>
<summary>
##### [08.12.2023] - Version 0.10.0</summary>
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
</details>
<details>
<summary>
##### [06.12.2023] - Version 0.9.0</summary>
* Improved Search function to allow multiple keywords
* More improvemnts in the background for faster datahandling, renamed a few variables to fit to new shorthand name AVE, etc.
* Added Usersettings Page, and did a lot of stuff related to this.
* Added Back to Top Button on all subpages.
</details>
<details>
<summary>
##### [04.12.2023] - Version 0.8.0</summary>
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
</details>
<details>
<summary>
##### [01.12.2023] - Version 0.7.1</summary>
* A lot of Stuff will work, lets call it the initial version
</details>
<details>
<summary>
##### [24.11.2023] - Version 0.1</summary>
* Start of this Project
</details>
</details>
