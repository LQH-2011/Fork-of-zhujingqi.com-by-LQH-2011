$("layoutBtn").onclick = () => {
	postLayout = postLayout === "list" ? "dense" : "list";
	localStorage.setItem("postLayout", postLayout);
	syncLayoutMode();
	syncLayoutBtn();
	$("posts").classList.toggle("denseLayout", postLayout === "dense");
};
$("discoverBtn").onclick = () => {
	show("discoverPage");
	setActive("discoverBtn");
};
$("profileBtn").onclick = () => {
	if (currentUser) {
		show("profilePage");
		viewUser(currentUser.id);
	}
	setActive("profileBtn");
};
$("logoutBtn").onclick = () => {
	stopPresence();
	localStorage.removeItem("loginUser");
	localStorage.removeItem("token");
	currentUser = null;
	enterGuestMode();
};
$("backBtn").onclick = () => {
	show("main");
	renderPostFilters();
	loadPosts(postPage);
	setActive("homeBtn");
	loadAnnouncements();
};
$("postBackBtn").onclick = () => {
	show("main");
	renderPostFilters();
	loadPosts(postPage);
	setActive("homeBtn");
	loadAnnouncements();
};
$("goRegister").onclick = () => {
	resetCaptcha();
	show("registerPage");
};
$("backLogin").onclick = () => show("welcomePage");
$("termsBtn").onclick = () => {
	document.querySelector(".modalBox").style.width = "800px";
	modal(t("terms_content"));
}

$("bgBuyBtn").textContent = selectedPostBg ? t("editor_bg_used") : t("editor_bg");
$("bgBuyBtn").onclick = openPostBgPicker;
const warnTextInput = $("warnText");
$("isSensitive").onchange = () => {
	if (!warnTextInput) return;
	if ($("isSensitive").checked) {
		warnTextInput.classList.add("show");
		warnTextInput.focus();
	} else {
		warnTextInput.classList.remove("show");
		warnTextInput.value = "";
	}
};

function openImagePicker() {
	document.querySelector(".modalBox").style.width = "420px";
	modal(`
		<h3>` + t("img_insert_title") + `</h3>
		<input id="imgUrlInput" placeholder="` + t("img_url_ph") + `" style="width:100%;">
		<div style="margin-top:8px;font-size:12px;color:var(--sub);text-align:left;">
			` + t("img_hint") + `
		</div>
		<div style="margin-top:14px;">
			<button id="imgApplyBtn">` + t("img_apply") + `</button>
		</div>
					`);
	$("imgApplyBtn").onclick = () => {
		const url = $("imgUrlInput").value.trim();
		if (!url) return modal(t("img_enter_url"));
		if (!/^https?:\/\//i.test(url)) return modal(t("img_invalid_url"));
		const textArea = $("text");
		textArea.value += (textArea.value ? "\n" : "") + `[img:${url}]` + "\n";
		$("modal").classList.add("hidden");
	};
}
$("insertImgBtn").onclick = openImagePicker;

function openMusicPicker() {
	document.querySelector(".modalBox").style.width = "420px";
	modal(`
		<h3>` + t("music_insert_title") + `</h3>
		<input id="musicUrlInput" placeholder="` + t("music_url_ph") + `" style="width:100%;">
		<div style="margin-top:8px;font-size:12px;color:var(--sub);text-align:left;">
			` + t("music_hint") + `
		</div>
		<div style="margin-top:14px;">
			<button id="musicApplyBtn">` + t("music_apply") + `</button>
		</div>
					`);
	$("musicApplyBtn").onclick = () => {
		const url = $("musicUrlInput").value.trim();
		if (!url) return modal(t("music_enter_url"));
		const textArea = $("text");
		let marker;
		if (/music\.163\.com/i.test(url)) {
			const idMatch = url.match(/id=(\d+)/);
			if (!idMatch) return modal(t("music_no_id"));
			marker = `[[music:netease:${idMatch[1]}]]`;
		} else if (/y\.qq\.com/i.test(url)) {
			const idMatch = url.match(/songid=(\d+)/);
			if (!idMatch) return modal(t("music_no_id"));
			marker = `[[music:qq:${idMatch[1]}]]`;
		} else {
			return modal(t("music_invalid"));
		}
		textArea.value += (textArea.value ? "\n" : "") + marker + "\n";
		$("modal").classList.add("hidden");
	};
}
$("insertMusicBtn").onclick = openMusicPicker;

function getPostMeta(content) {
	let text = String(content || "").trim();
	let bg = null,
		warn = false,
		warnText = t("warn_default"),
		music = null,
		img = null;
	const prefixMatch = text.match(/^(\[\[bg:(.+?)\]\]|\[\[warn(?::([^\]]+))?\]\])+/);
	if (prefixMatch) {
		let prefix = prefixMatch[0];
		text = text.slice(prefix.length).trim();
		if (prefix.includes("[[bg:")) bg = prefix.match(/\[\[bg:(.+?)\]\]/)[1];
		if (prefix.includes("[[warn")) {
			warn = true;
			const w = prefix.match(/\[\[warn(?::([^\]]+))?\]\]/);
			if (w && w[1]) warnText = w[1];
		}
	}
	const musicMatch = text.match(/\[\[music:(netease|qq):(\d+)\]\]/) || text.match(
		/\[\[music:(\d+)\]\]/);
	if (musicMatch) {
		music = musicMatch[1] === "netease" || musicMatch[1] === "qq" ? {
			type: musicMatch[1],
			id: musicMatch[2]
		} : {
			type: "netease",
			id: musicMatch[1]
		};
		text = text.replace(/\[\[music:(?:netease|qq):\d+\]\]|\[\[music:\d+\]\]/g, "").trim();
	}
	const imgMatch = text.match(/\[img:(.*?)\]/);
	if (imgMatch) {
		img = imgMatch[1];
		text = text.replace(/\[img:.*?\]/g, "").trim();
	}
	return {
		bg,
		warn,
		warnText,
		music,
		img,
		content: text
	};
}

async function renderPostBody(box, fullContent) {
	const meta = getPostMeta(fullContent);
	const hasHtml = /<[^>]+>/.test(meta.content);
	const plainText = meta.content.replace(/<[^>]*>/g, "");
	const needFold = !hasHtml && plainText.length > (postLayout === "dense" ? 120 : 300);
	const foldedText = needFold ? plainText.slice(0, 300) + " ..." : "";
	let html = "";
	if (meta.music) {
		html += renderMusicCard(meta.music) + '<div style="height:12px"></div>';
	}
	if (meta.img) {
		html +=
			`<div style="margin:8px 0;"><button class="loadImgBtn" data-src="${escapeAttr(meta.img)}" style="width:100%;padding:12px;border-radius:20px;background:var(--card);color:var(--text);font-size:16px;cursor:pointer;border:1px solid var(--border);text-align:center;transition:.2s;" onmouseover="this.style.background='var(--grad)';this.style.color='#fff'" onmouseout="this.style.background='';this.style.color=''">${t("post_load_img")}</button></div>`;
	}
	html += needFold ?
		`<span class="longPostText">${foldedText}</span><button class="toggleLongPost inline">${t("post_expand")}</button>` :
		(meta.content || "");
	box.innerHTML = html;
	await ensureAllUsersCache();
	linkifyMentions(box);
	renderEmojis(box);
	linkifyUrls(box);
	const loadBtn = box.querySelector(".loadImgBtn");
	if (loadBtn) {
		loadBtn.onclick = () => {
			const src = loadBtn.dataset.src;
			loadBtn.outerHTML =
				`<img src="${src}" class="zoomable" style="max-width:60%;border-radius:12px;display:block;">`;
		};
	}
	const toggleBtn = box.querySelector(".toggleLongPost");
	if (toggleBtn) {
		let e = false;
		toggleBtn.onclick = () => {
			e = !e;
			const l = box.querySelector(".longPostText");
			if (l) l.innerHTML = e ? meta.content : foldedText;
			linkifyMentions(box);
			renderEmojis(box);
			linkifyUrls(box);
			toggleBtn.textContent = e ? t("post_collapse") : t("post_expand");
		};
	}
}

function renderMusicCard(music) {
	const id = typeof music === "string" ? music : music.id;
	if (typeof music === "object" && music.type === "qq") {
		return `<div class="musicCard"><iframe class="musicIframe" src="https://i.y.qq.com/n2/m/outchain/player/index.html?songid=${id}&songtype=0" width="100%" height="86" frameborder="0" allow="autoplay; encrypted-media" loading="lazy"></iframe></div>`;
	}
	return `<div class="musicCard"><iframe class="musicIframe" src="https://music.163.com/outchain/player?type=2&id=${id}&auto=0&height=86" width="100%" height="106" frameborder="0" allow="autoplay; encrypted-media" loading="lazy"></iframe></div>`;
}

function setActive(id) {
	["homeBtn", "editorBtn", "showUsersBtn", "profileBtn", "discoverBtn"]
	.forEach(b => $(b).classList.remove("active"));
	$(id).classList.add("active");
}
function openPostBgPicker() {
	if (!currentUser) return;
	document.querySelector(".modalBox").style.width = "420px";
	let picked = "";
	modal(`
						<h3>` + t("bg_picker_title") + `</h3>
						<div style="font-size:14px;color:var(--sub);margin-bottom:12px;">
							` + t("bg_picker_desc") + `
						</div>
						<div id="bgPickerGrid" class="bgPickerGrid"></div>
						<div style="margin-top:14px;text-align:center;">
							<button id="bgApplyBtn" disabled>` + t("bg_apply") + `</button>
						</div>
					`);
	const grid = $("bgPickerGrid");
	for (const color of POST_BG_OPTIONS) {
		const item = document.createElement("div");
		item.className = "bgOption";
		item.style.background = color;
		item.onclick = () => {
			picked = color;
			grid.querySelectorAll(".bgOption").forEach(el => el.classList.remove("active"));
			item.classList.add("active");
			$("bgApplyBtn").disabled = false;
		};
		grid.appendChild(item);
	}
	$("bgApplyBtn").onclick = async () => {
		if (!picked) return;
		if ((currentUser.coins || 0) < POST_BG_COST) {
			return modal(t("coins_insufficient"));
		}
		await changeCoins(currentUser.id, -POST_BG_COST);
		selectedPostBg = picked;
		$("bgBuyBtn").textContent = t("editor_bg_used");
		$("modal").classList.add("hidden");
		showCoinMsg(t("bg_applied"));
	};
}
