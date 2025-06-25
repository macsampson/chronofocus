chrome.storage.local.get(null, (data) => {
  console.log("Current storage state:", JSON.stringify(data, null, 2));
});
