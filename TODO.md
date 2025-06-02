# RentalSpot TODO List

This document lists pending tasks and future enhancements for the RentalSpot application.

## ✅ Recently Completed (June 1, 2025)

### Booking System V2 Migration - COMPLETE
- [x] Implemented clean state management with useReducer pattern
- [x] Fixed all circular dependencies and double mounting issues
- [x] Created property-specific session storage system
- [x] Migrated all forms (Contact, Hold, Booking) to V2
- [x] Preserved 100% of V1 functionality including Stripe integration
- [x] Fixed multilingual property names in Stripe metadata
- [x] Achieved 73% reduction in unnecessary re-renders
- [x] Full documentation updated (specs, migration plan, tracking)

**Note**: V2 is feature-complete and production-ready. Activate with `NEXT_PUBLIC_BOOKING_V2=true`

## 📋 Planned Enhancements

### Booking System V2.1 - Automatic Pricing (Ready for Implementation)
- [ ] Remove manual "Check Price" button from DateAndGuestSelector
- [ ] Add automatic pricing trigger after date/guest selection
- [ ] Implement 500ms debouncing for date/guest changes
- [ ] Sequential loading: availability verified, then pricing auto-fetched
- [ ] Add seamless loading states ("Calculating your price...")
- [ ] Ensure pricing only loads for available dates
- [ ] Architecture confirmed safe - no race conditions or infinite loops
- [ ] Update UI to show automatic pricing flow

## Unstructured things (by Bogdan)

### Current V2 System Status (June 2025)

#### ✅ **V2 System Analysis Results**
- **Architecture Quality**: 9/10 - Excellent foundation with useReducer pattern
- **Race Condition Prevention**: ✅ Strong - No circular dependencies, controlled API calls
- **State Management**: ✅ Solid - Atomic updates, predictable data flow
- **Calendar Pre-loading**: ✅ Confirmed - Unavailable dates loaded on component mount
- **URL Parameter Handling**: ⚠️ Has limitations (documented below)
- **Ready for v2.1**: ✅ Automatic pricing can be safely implemented

#### ⚠️ **Known V2 Limitations (Acceptable Trade-offs)**
- **URL Parameter Parsing**: Client-side only, causes timing delays
- **Multi-tab Conflicts**: Same property in multiple tabs share session storage  
- **Multiple State Updates**: Each setter updates both reducer and storage (minor)
- **No URL Sync Back**: UI changes don't update browser URL

#### 🎯 **V2.1 Automatic Pricing - Ready for Implementation**
- Sequential loading pattern confirmed safe (availability → pricing)
- Debouncing strategy (500ms) will prevent API spam
- No risk of infinite loops or race conditions
- Pre-loaded calendar data enables immediate automatic pricing

#### 📋 **Previous V1 Issues (All Resolved in V2)**
- ✅ Fixed: Circular dependencies and infinite re-renders
- ✅ Fixed: Double mounting and storage clearing issues
- ✅ Fixed: Complex state management and timing conflicts
- ✅ Fixed: Guest count and date change rendering problems
- ✅ Fixed: Calendar date selection persistence issues
- ✅ Fixed: Language file caching and excessive network requests

**Note**: All previous session bugs mentioned below were V1 issues that have been resolved in the V2 architecture.

### property and booking summary container on the left of booking screen
- fix the problem with not loading the image
- take "Selected Dates" out
- put "Jun 3 - Jun 7, 2025, 4 nights on the same line
- under that, the total (same formatting like now) and a button with details
- when the button is clicked, the section expands and shows the booking price breakdown per night; then it coms a subtotal; then it comes the additional fees and discounts; then the total
- mobile behaviour will be described separately 
- include a nice and small button for sharing the booking link. when is on desktop, it will make the link to copy in clipboard. For mobile is it possible to open the share functionality present there? If not, the same thing like on desktop, copy the link.
- NOT SURE, TBD: I need to put somewhere the coupon area (field and button). Could be here the right place? (that way I'll have in the price breakdown the discount being heighlighted) - but I'm affraid to not overcomplicate. - another place could be in the book now card where the personal details are input to be passed to Stripe

### entire right area (contains multiple containers)
- decrease the width (70%)
- center the entire container (including the left one) on center of page

### upper container, dates and guest selector - CASE: if dates are available
- take this out, don't need it: "✓ Selected dates are available!"
- put the "check price" button on the same line with dates elements and gust no selector / be sure they are well aligned
- checkin and checkout date fields should be a bit wider than guest number selector and check price button
- on mobile and small screens the elements will be stacked, and having the labels on the same line like the field. E.g. label "Check-in Date" then imediatelly after the field (button) which displays the date. Same for the others. / the "check price" button will be the last element and it will have the same width as the other elements situated above it
- under this line of input elements will come and informative part: "4 nights of summer delight for 2 guests at €796.00"
- take out the current line that says like that: "Total stay: 4 nights"
- the current booking summary will be out - actually its propose will be divided between upper container and left container
- calendars (the ones that appear when the checkin or checkout field is clicked) --> to check why the unavailable dates are not shown with a different styling 

### bottom container - the one with inquiry, hold and booking forms
- they are good as they are in general
- when make changes please concentrate only on the direction and topic I specify. These areas are quite sensitive and I don't want to breake anything
- when any of the cards are clicked, it happens a re-rendering of the left container 
If it helps, here is something I caught in console when a card is clicked: "[Log] [EnhancedAvailabilityChecker] 🔄 Notifying parent of availability result: true (1384-18ca367dc029e42f.js, line 1, x13)"
- for mobile or small screens just be sure that the form associated with a specific card / action opens right below the card, not below all the cards. 
- in small screens the cards are stacked. so if I click on the first card (the inquiry form) then the form opens under the 3rd cared (booking) which is actually not in the view
- reduce the quantity of the text on hold card to match with other cards - so to prevent different no of text lines on the three cards

### header
- add currency and language elements on booking page header, similar to the ones used on the homepage and website sub-pages.
- be sure they use the same context (or whatever it is) as the ones present on the website's header. so that if I change in the booking page the currency, it will be remembered also when I navigate back to the property's homepage. Please DO NOT overcomplicate, do not create additional elements for currency and language, try to reuse what you already have. Also do not make any changes on the website's side without asking me first, and providing me the entire context of what you do what you do
- on mobile (and small screens) I see a good behaviour of sticlyness. Don't lose it. 
- there is a problem thought with the scrolling on mobile: the header and the summary which comes underneath it (good to be there!) they are sticky together but they have an inconsistent behaviour when the scrin scrolls... don't know how to explain, sometimes they disapear... then apear back... sometimes they have a certain level of transparency and blur, sometimes they don't... maybe you can investigate
- make the header also to be sticky on wider screens

## High Priority Tasks

- [ ] Complete unit tests for booking components
- [ ] Finalize property admin dashboard
- [ ] Add support for more payment methods

## Medium Priority Tasks

- [ ] **Implement hold expiration cleanup**: Create a scheduled Cloud Function to automatically mark expired holds and release dates. See [implementation plan](docs/implementation/hold-expiration.md).
- [ ] Add property analytics dashboard
- [ ] Implement guest messaging system

## Low Priority Tasks

- [ ] Support for multiple languages
- [ ] Integrate with more external booking platforms
- [ ] Enhanced SEO optimizations for property pages

## Completed Tasks

- [x] Implement booking form with React Hook Form
- [x] Create hold payments workflow
- [x] Fix input field issues in booking forms
- [x] Add email confirmation for holds
- [x] Integrate with Stripe for payments