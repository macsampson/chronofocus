// Content script for ChronoFocus extension
// This script runs on web pages to track user activity

console.log("ChronoFocus content script loaded")

// Track user activity and distracting sites
let isOnDistractingSite = false
const distractingSites = [
  "facebook.com",
  "twitter.com",
  "instagram.com",
  "youtube.com",
  "reddit.com",
  "tiktok.com",
]

// Check if current site is distracting
function checkIfDistractingSite(): boolean {
  const hostname = window.location.hostname.toLowerCase()
  return distractingSites.some((site) => hostname.includes(site))
}

// Initialize
isOnDistractingSite = checkIfDistractingSite()

if (isOnDistractingSite) {
  console.log("User is on a distracting site:", window.location.hostname)

  // Send message to background script
  chrome.runtime.sendMessage({
    type: "DISTRACTING_SITE_DETECTED",
    url: window.location.href,
    hostname: window.location.hostname,
  })
}

// Listen for focus/blur events to track engagement
let focusStartTime = Date.now()
let totalFocusTime = 0

window.addEventListener("focus", () => {
  focusStartTime = Date.now()
})

window.addEventListener("blur", () => {
  if (focusStartTime) {
    totalFocusTime += Date.now() - focusStartTime
  }
})

// Send focus data periodically
setInterval(() => {
  if (totalFocusTime > 0) {
    chrome.runtime.sendMessage({
      type: "FOCUS_TIME_UPDATE",
      focusTime: totalFocusTime,
      url: window.location.href,
    })
    totalFocusTime = 0 // Reset
  }
}, 30000) // Every 30 seconds

export {}
