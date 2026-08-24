async function hash(text) {
	const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function isAdmin(user) {
	return user?.role?.includes?.('owner') || user?.role?.includes?.('admin');
}

const ROLE_CONFIG = {
	owner: {
		label: 'V',
		color: '#d4a017',
		title: '站长'
	},
	official: {
		label: 'V',
		color: '#00aaff',
		title: '官方用户'
	},
	admin: {
		label: 'A',
		color: '#ff3b30',
		title: '联席管理员'
	},
	green_v: {
		label: 'V',
		color: '#4caf50',
		title: '绿V徽章'
	},
	purple_star: {
		label: '★',
		color: '#9c27b0',
		title: '紫星徽章'
	},
	blue_diamond: {
		label: '◆',
		color: '#2196f3',
		title: '蓝钻徽章'
	},
};

function getRoleBadge(user) {
	if (!user?.role || !Array.isArray(user.role)) return "";
	for (const r of user.role) {
		const cfg = ROLE_CONFIG[r];
		if (cfg) return `<span class="roleBadge ${r}" title="${t('role_'+r)}"></span>`;
	}
	return "";
}

const SHOP_ITEMS = [{
		id: 'green_v',
		name: '绿色V标',
		price: 500
	},
	{
		id: 'purple_star',
		name: '紫星徽章',
		price: 400
	},
	{
		id: 'blue_diamond',
		name: '蓝钻徽章',
		price: 300
	},
	// {
	// 	id: 'flower',
	// 	name: '一束花',
	// 	price: 20,
	// 	gift: 18
	// },
	// {
	// 	id: 'chocolate',
	// 	name: '巧克力',
	// 	price: 30,
	// 	gift: 27
	// },
	// {
	// 	id: 'cake',
	// 	name: '蛋糕',
	// 	price: 50,
	// 	gift: 45
	// },
];

