function closeSearchSheet() {
	$("searchOverlay").classList.add("hidden");
}
$("searchOverlay").onclick = e => {
	if (e.target === $("searchOverlay")) closeSearchSheet();
};
document.addEventListener("keydown", e => {
	if (e.key === "Escape" && !$("searchOverlay").classList.contains("hidden")) closeSearchSheet();
});
