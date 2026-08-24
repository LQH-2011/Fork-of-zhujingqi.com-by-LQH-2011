const API_BASE = "https://jqtljtnchkhzcxykfnoo.supabase.co/functions/v1";
async function api(path, options = {}) {
	const headers = {
		"Content-Type": "application/json",
		...options.headers
	};
	const token = localStorage.getItem("token");
	if (token) headers["Authorization"] = "Bearer " + token;
	const res = await fetch(API_BASE + path, {
		...options,
		headers
	});
	const text = await res.text();
	if (!res.ok) {
		let msg = text;
		try {
			const j = JSON.parse(text);
			if (j.error) msg = j.error;
		} catch {}
		if (/jwt|expir|unauthorized/i.test(msg)) {
			localStorage.removeItem("token");
			localStorage.removeItem("loginUser");
			setTimeout(() => {
				const mt = document.getElementById("modalText");
				const me = document.getElementById("modal");
				if (mt && me) {
					const errMsg = typeof t === "function" ? t("jwt_expired") : "登录已过期，请重新登录";
					const btnText = typeof t === "function" ? t("jwt_login_btn") : "去登录";
					mt.innerHTML = errMsg +
						'<br><br><button onclick="document.getElementById(\'modal\').classList.add(\'hidden\');show(\'welcomePage\')" style="background:var(--green);color:#fff;padding:10px 30px;border-radius:20px;border:none;font-size:16px;cursor:pointer">' +
						btnText + '</button>';
					me.classList.remove("hidden");
				}
			}, 0);
			throw new Error("JWT_EXPIRED");
		}
		throw new Error(msg);
	}
	return text ? JSON.parse(text) : null;
}

async function apiGet(path) {
	return api(path);
}

async function apiPost(path, body) {
	return api(path, {
		method: "POST",
		body: JSON.stringify(body)
	});
}

async function apiPut(path, body) {
	return api(path, {
		method: "PUT",
		body: JSON.stringify(body)
	});
}

async function apiDelete(path, body) {
	return api(path, {
		method: "DELETE",
		body: JSON.stringify(body)
	});
}

let gestureWatch = false;
let watchSequence = [];
const WATCH_PATTERN = ["editorBtn", "discoverBtn", "editorBtn", "discoverBtn", "editorBtn"];

function isWatchMode() {
	return gestureWatch;
}

function syncWatchMode() {
	document.documentElement.classList.toggle("watch", isWatchMode());
}
document.addEventListener("click", (e) => {
	const btn = e.target.closest("#nav button[id]");
	if (!btn) return;
	const id = btn.id;
	if (WATCH_PATTERN.includes(id)) {
		watchSequence.push(id);
		if (watchSequence.length > WATCH_PATTERN.length) {
			watchSequence.shift();
		}
		if (watchSequence.join() === WATCH_PATTERN.join()) {
			watchSequence = [];
			gestureWatch = true;
			syncWatchMode();
			if (typeof show === "function") show("main");
		}
	} else {
		watchSequence = [];
	}
});
syncWatchMode();
