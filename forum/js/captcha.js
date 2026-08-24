let captchaPassed = false;
let captchaOffset = 0;
let captchaCleanup = null;

function openCaptchaModal() {
	$("captchaModal").classList.remove("hidden");
	const canvas = $("captchaCanvas");
	const ctx = canvas.getContext("2d");
	const W = 320,
		H = 160;
	const pieceW = 48;
	const seed = Math.floor(Math.random() * 1000000);
	captchaOffset = 30 + Math.floor(Math.random() * (W - pieceW - 60));
	captchaPassed = false;

	function seededRand(s) {
		let x = Math.sin(s * 9301 + 49297) * 49297;
		return x - Math.floor(x);
	}
	const colors = [];
	for (let i = 0; i < 40; i++) {
		const r = Math.floor(seededRand(seed + i * 3) * 180 + 60);
		const g = Math.floor(seededRand(seed + i * 3 + 1) * 180 + 60);
		const b = Math.floor(seededRand(seed + i * 3 + 2) * 180 + 60);
		colors.push(`rgb(${r},${g},${b})`);
	}
	ctx.clearRect(0, 0, W, H);
	const stripW = W / colors.length;
	for (let i = 0; i < colors.length; i++) {
		ctx.fillStyle = colors[i];
		ctx.fillRect(i * stripW, 0, Math.ceil(stripW) + 1, H);
	}
	ctx.fillStyle = "#000";
	ctx.globalAlpha = 0.1;
	for (let i = 0; i < 6; i++) {
		const x = seededRand(seed + i * 7) * W;
		const w = 1 + seededRand(seed + i * 11) * 2;
		ctx.fillRect(x, 0, w, H);
	}
	ctx.globalAlpha = 1;
	ctx.fillStyle = "rgba(0,200,0,.15)";
	ctx.fillRect(captchaOffset, 0, pieceW, H);
	ctx.strokeStyle = "rgba(0,255,0,.8)";
	ctx.lineWidth = 2;
	ctx.setLineDash([6, 4]);
	ctx.strokeRect(captchaOffset, 0, pieceW, H);
	ctx.setLineDash([]);
	const target = $("captchaTarget");
	target.style.left = captchaOffset + "px";
	target.style.width = pieceW + "px";
	const thumb = $("captchaThumb");
	thumb.style.left = "0px";
	thumb.textContent = "→";
	thumb.style.background = "var(--green)";
	thumb.style.cursor = "grab";
	let dragging = false,
		startX = 0,
		thumbOff = 0;

	function onMove(clientX) {
		if (!dragging) return;
		let dx = clientX - startX + thumbOff;
		dx = Math.max(0, Math.min(W - pieceW, dx));
		thumb.style.left = dx + "px";
		const diff = Math.abs(dx - captchaOffset);
		if (diff < 8) {
			thumb.style.background = "#0a0";
			thumb.textContent = "✓";
		} else {
			thumb.style.background = "var(--green)";
			thumb.textContent = "→";
		}
	}

	function onEnd() {
		if (!dragging) return;
		dragging = false;
		thumb.style.cursor = "grab";
		const dx = parseInt(thumb.style.left) || 0;
		if (Math.abs(dx - captchaOffset) < 8) {
			thumb.style.left = captchaOffset + "px";
			thumb.style.background = "#0a0";
			thumb.textContent = "✓";
			captchaPassed = true;
			$("captchaStatus").textContent = "✅";
			$("registerBtn").disabled = false;
			$("registerBtn").style.opacity = "1";
			$("registerBtn").style.cursor = "pointer";
			setTimeout(() => {
				$("captchaModal").classList.add("hidden");
				cleanup();
			}, 600);
		} else {
			thumb.style.left = "0px";
			thumb.textContent = "→";
			thumb.style.background = "var(--green)";
		}
	}

	function onDown(clientX) {
		dragging = true;
		startX = clientX;
		thumbOff = parseInt(thumb.style.left) || 0;
		thumb.style.cursor = "grabbing";
	}

	function onMouseMove(e) {
		onMove(e.clientX);
	}

	function onMouseUp() {
		onEnd();
	}

	function onTouchMove(e) {
		onMove(e.touches[0].clientX);
	}

	function onTouchEnd() {
		onEnd();
	}

	function cleanup() {
		document.removeEventListener("mousemove", onMouseMove);
		document.removeEventListener("mouseup", onMouseUp);
		document.removeEventListener("touchmove", onTouchMove);
		document.removeEventListener("touchend", onTouchEnd);
	}
	thumb.onmousedown = (e) => {
		onDown(e.clientX);
		e.preventDefault();
	};
	thumb.ontouchstart = (e) => {
		onDown(e.touches[0].clientX);
		e.preventDefault();
	};
	document.addEventListener("mousemove", onMouseMove);
	document.addEventListener("mouseup", onMouseUp);
	document.addEventListener("touchmove", onTouchMove, {
		passive: false
	});
	document.addEventListener("touchend", onTouchEnd);
	captchaCleanup = cleanup;
	document.querySelector("#captchaModal .modalBox").style.width = "";
}
$("captchaCloseBtn").onclick = () => {
	$("captchaModal").classList.add("hidden");
	if (captchaCleanup) captchaCleanup();
};

function resetCaptcha() {
	captchaPassed = false;
	$("captchaStatus").textContent = "";
	$("registerBtn").disabled = true;
	$("registerBtn").style.opacity = ".5";
	$("registerBtn").style.cursor = "not-allowed";
}
