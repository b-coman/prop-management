# RentalSpot TODO List

This document lists pending tasks and future enhancements for the RentalSpot application.

## Unstructured things (by Bogdan)

### current bugs (under the current session)
- when I change the no of guests, it doesn't updates in the summary container (where it said like this: "Booking Summary: 4 nights, 2 guests, Total: €796.00 View Details")
- when I change the no of guests, it looks like there is a complete rendering of all containers. Isn't possible to update only what is needed, only the details and numbers, without re-rendering the entire container? how hard would be? would this involve structural changes or massive code interventions?
- same situation with checkin and checkout fields - on date change
- whatever I choose in the calendar, the dates stay fixed. For example, the page loads with 3-7 June as dates. I try to put check-in on June 1st, it allows me to pick that date, but actually the change isn't made. It stays June 3rd
For additional details try to understand why those two logs happens:
[Log] [EnhancedAvailabilityChecker] Check-in date changed to: – Wed Jun 11 2025 00:00:00 GMT+0300 (Eastern European Summer Time)  (1384-18ca367dc029e42f.js, line 1)
[Log] [EnhancedAvailabilityChecker] 🔧 Normalized checkIn: 2025-06-10T21:00:00.000Z → 2025-06-10T12:00:00.000Z (1384-18ca367dc029e42f.js, line 1)
- at a moment I tested something in the UI (the page was already loaded) but not having internet connection. I didn't know, it was just happening. Anyway, the fact is I observed at that moment plenty of requests to https://prop-management-po7frlmwzq-ez.a.run.app/locales/en.json... there were more than 10 requests just when I tried to change the checkin date --> my question: the language files aren't they cached, loaded at the client?

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