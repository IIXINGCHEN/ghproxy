/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
    // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
    // MY_KV_NAMESPACE: KVNamespace;
    //
    // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
    // MY_DURABLE_OBJECT: DurableObjectNamespace;
    //
    // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
    // MY_BUCKET: R2Bucket;
}

export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext
    ): Promise<Response> {
        try {
            return await fetchHandler(request);
        } catch (err) {
            return makeRes("cfworker error:\n" + err.stack, 502);
        }
    },
};
/**
 * static files (404.html, sw.js, conf.js)
 */
const ASSET_URL = "https://ghproxy.homeboyc.cn";
// 前缀，如果自定义路由为example.com/gh/*，将PREFIX改为 '/gh/'，注意，少一个杠都会错！
const PREFIX = "/";
// 分支文件使用jsDelivr镜像的开关，0为关闭，默认关闭
const Config = {
    jsdelivr: 0,
};

const whiteList: string[] = []; // 白名单，路径里面有包含字符的才会通过，e.g. ['/username/']

/** @type {ResponseInit} */
const PREFLIGHT_INIT = {
    status: 204,
    headers: new Headers({
        "access-control-allow-origin": "*",
        "access-control-allow-methods":
            "GET,POST,PUT,PATCH,TRACE,DELETE,HEAD,OPTIONS",
        "access-control-max-age": "1728000",
    }),
};

const baseGithubExp = /^(?:https?:\/\/)?github\.com\/(.+?)\/(.+?)\//;

// 基于baseGithubExp构建更具体的正则表达式
const releaseExp = baseGithubExp.source + '(?:releases|archive)\/.*$/i';
const fileExp = baseGithubExp.source + '(?:blob|raw)\/.*$/i';
const infoExp = baseGithubExp.source + '(?:info|git-).*$/i';
// 注意：对于rawExp和gistExp，我们需要稍微修改以匹配不同的域名结构
const rawExp = /^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com\/(.+?)\/(.+?)\/.+$/i;
const gistExp = /^(?:https?:\/\/)?gist\.(?:githubusercontent|github)\.com\/(.+?)\/(.+?)\/.+$/i;
// 其他的表达式不需要基于baseGithubExp，因为它们没有共同的路径结构
const tagsPageExp = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/tags.*$/i;
const apiExp = /^(?:https?:\/\/)?api\.github\.com\/.*$/i;
const oauthExp = /^(?:https?:\/\/)?github\.com\/login\/oauth\/.*$/i;

// 使用RegExp构造函数来创建正则表达式对象（如果需要的话）
const releaseRegExp = new RegExp(releaseExp);
// ... 为其他表达式同样创建RegExp对象（如果需要的话）

/**
 * @param {any} body
 * @param {number} status
 * @param {Object<string, string>} headers
 */
function makeRes(body: any, status: number = 200, headersInit: HeadersInit = {}) {
    const headers = new Headers(headersInit);
    headers.set("access-control-allow-origin", "*");
    return new Response(body, { status, headers });
}
/**
 * @param {string} urlStr
 */
function newUrl(urlStr: string): URL | null {
    try {
        return new URL(urlStr);
    } catch (err) {
        // 在这里，我们保持返回 null 的逻辑不变，但明确了函数可能返回 null
        return null;
    }
}

// 或者，为了增加代码的健壮性，你可以使用 TypeScript 的类型守卫（Type Guards）
function isValidUrl(urlStr: string): urlStr is string & { isValidUrl: true } {
    try {
        new URL(urlStr);
        return true;
    } catch (err) {
        return false;
    }
}

// 然后，你可以在其他地方使用 isValidUrl 来确保 URL 的有效性
// ...
if (isValidUrl(someUrlString)) {
    // 已知 someUrlString 是一个有效的 URL
    const url = new URL(someUrlString);
    // ...
}

/**
 * 检查给定的URL字符串是否符合预定义的正则表达式模式之一
 *
 * @param u 要检查的URL字符串
 * @returns 如果URL匹配任何模式，则返回true；否则返回false
 */
function checkUrl(u: string): boolean {
    return [
        releaseExp,
        fileExp,
        infoExp,
        rawExp,
        gistExp,
        tagsPageExp,
        apiExp,
        oauthExp,
    ].some(pattern => u.search(pattern) === 0);
}

/**
 * @param {Request} req
 */
const patterns = [
    releaseExp,
    gistExp,
    tagsPageExp,
    infoExp,
    rawExp,
    apiExp,
    oauthExp
];
async function fetchHandler(req: Request): Promise<Response> {
    const urlStr = req.url;
    const urlObj = new URL(urlStr);
    let path = urlObj.searchParams.get("q");

    if (path) {
        return Response.redirect(`https://${urlObj.host}${PREFIX}${path}`, 301);
    }

    // cfworker 会把路径中的 `//` 合并成 `/`
    path = urlObj.pathname.slice(PREFIX.length); // 直接使用pathname，更简洁

    if (patterns.some(pattern => path.search(pattern) === 0)) {
        return await httpHandler(req, `https://github.com${path}`); // 根据情况可能需要调整URL格式
    } else if (path.search(fileExp) === 0) {
        if (Config.jsdelivr) {
            const newUrl = urlStr
                .replace(/^https?:\/\/github\.com/, "https://cdn.jsdelivr.net/gh")
                .replace("/blob/", "@");
            return Response.redirect(newUrl, 302);
        } else {
            const newPath = path.replace("/blob/", "/raw/");
            return await httpHandler(req, `https://github.com${newPath}`); // 明确URL前缀
        }
    } else if (path.search(rawExp) === 0) {
        const newUrl = urlStr
            .replace(/(?<=com\/.+?\/.+?)\/(.+?\/)/, "@$1")
            .replace(/^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com/, "https://cdn.jsdelivr.net/gh");
        return Response.redirect(newUrl, 302);
    } else {
        return await fetch(ASSET_URL + path);
    }
}

/**
 * @param {Request} req
 * @param {string} pathname
 */
async function httpHandler(req: Request, pathname: string): Promise<Response> {
    // preflight
    if (
        req.method === "OPTIONS" &&
        req.headers.has("access-control-request-headers")
    ) {
        return new Response(null, PREFLIGHT_INIT);
    }

    let urlStr = pathname;
    const isWhiteListed = whiteList.some(i => urlStr.includes(i));
    if (!isWhiteListed) {
        return new Response("blocked", { status: 403 });
    }

    // 尝试将pathname转换为URL，如果失败则视为无效URL
    const urlObj = newUrl(urlStr);
    if (!urlObj) {
        return new Response("invalid url", { status: 400 });
    }

    // 如果URL没有协议，则添加https://
    if (!urlObj.protocol) {
        urlStr = "https://" + urlStr;
        urlObj = newUrl(urlStr); // 再次解析新的urlStr确保没有问题
    }

    const reqHdrNew = new Headers(req.headers);

    /** @type {RequestInit} */
    const reqInit = {
        method: req.method,
        headers: reqHdrNew,
        redirect: "manual",
        body: req.body,
    };
    return await proxy(urlObj, reqInit);
}

/**
 *
 * @param {URL} urlObj
 * @param {RequestInit} reqInit
 */
async function proxy(
    urlObj: URL | null,
    reqInit: RequestInit
): Promise<Response> {
    if (urlObj === null) {
        return new Response("invalid url", { status: 400 });
    }

    try {
        const res = await fetch(urlObj.href, reqInit);

        if (!res.ok) { // 检查响应是否成功
            return new Response("Request failed", { status: res.status });
        }

        const resHdrOld = res.headers;
        const resHdrNew = new Headers(resHdrOld);

        if (resHdrNew.has("location")) {
            let _location = resHdrNew.get("location") || "";

            if (!_location.startsWith("http")) { // 添加基础URL，如果location不是完整的URL
                _location = new URL(_location, urlObj.href).href;
            }

            if (checkUrl(_location)) {
                resHdrNew.set("location", PREFIX + _location);
            } else {
                // 为了避免无限递归，这里直接返回重定向响应，而不是再次调用proxy
                return Response.redirect(_location, 302);
            }
        }
        // ... 其他header处理逻辑 ...
        return new Response(res.body, {
            status: res.status,
            headers: resHdrNew,
        });
    } catch (error) {
        // 适当的异常处理
        console.error("Error fetching URL:", urlObj.href, error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
