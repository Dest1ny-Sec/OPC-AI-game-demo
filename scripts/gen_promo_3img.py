#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""弄堂沉浮录·1936 宣传图重生 (3 张并行)"""
import urllib.request
import json
import os
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed

API_URL = "https://grsai.dakka.com.cn/v1/api/generate"
API_KEY = "sk-1f5f714e6b0b46f19bb88a9fde7e6160"
MODEL = "gpt-image-2"

OUT_DIR = "/Users/destiny/Downloads/haipai/city-whispers/docs/screenshots"
os.makedirs(OUT_DIR, exist_ok=True)


def gen(prompt: str, aspect_ratio: str, out_path: str, max_retry: int = 1):
    """调用 gpt-image-2 生成图片,失败自动重试一次。返回 dict 含 task_id/size/path/status/error。"""
    attempt = 0
    last_err = None
    task_id = None
    while attempt <= max_retry:
        attempt += 1
        t0 = time.time()
        try:
            payload = {
                "model": MODEL,
                "prompt": prompt,
                "aspectRatio": aspect_ratio,
                "replyType": "json",
            }
            req = urllib.request.Request(
                API_URL,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json",
                },
            )
            with urllib.request.urlopen(req, timeout=180) as resp:
                body = resp.read().decode("utf-8")
            r = json.loads(body)
            # 记录 task_id(若响应中含)
            task_id = (
                r.get("id")
                or r.get("task_id")
                or r.get("taskId")
                or (r.get("results", [{}])[0].get("task_id") if r.get("results") else None)
                or "(no-id-in-response)"
            )
            url = r["results"][0]["url"]
            # 下载图片
            urllib.request.urlretrieve(url, out_path)
            size = os.path.getsize(out_path)
            elapsed = time.time() - t0
            return {
                "path": out_path,
                "size": size,
                "task_id": task_id,
                "elapsed": round(elapsed, 2),
                "attempts": attempt,
                "status": "ok",
                "aspect": aspect_ratio,
            }
        except Exception as e:  # noqa: BLE001
            last_err = f"{type(e).__name__}: {e}"
            elapsed = time.time() - t0
            print(f"[RETRY {attempt}] {os.path.basename(out_path)} failed after {elapsed:.1f}s: {last_err}")
    return {
        "path": out_path,
        "size": 0,
        "task_id": task_id or "(unknown)",
        "elapsed": round(elapsed if 'elapsed' in dir() else 0, 2),
        "attempts": attempt,
        "status": "fail",
        "error": last_err,
        "aspect": aspect_ratio,
    }


COVER_PROMPT = (
    "1936年上海武康路俯瞰全景，黄昏时分。左下角是五洲大药房的二层老式店面，"
    "木质招牌写着「五洲大药房」四个繁体字，门口站着一袭青衫的掌柜项松茂，"
    "圆脸礼帽长衫马褂，表情严肃。街对面是三层武康大楼（船头形）的早期模样，"
    "远处可见永安百货的轮廓。弄堂里有黄包车、穿长衫的路人、挑担的货郎。"
    "天空是晚霞，橘红色与靛青交融，远处黄浦江上停着老式货船。"
    "整张图色调是纸白、墨青、朱砂、淡金四种海派色，30年代老上海风情，"
    "无水印无LOGO无现代元素，电影级画面构图，超精细细节。"
)

DIALOGUE_PROMPT = (
    "1936年上海五洲大药房内景，左侧是一位中年掌柜（项松茂）站在药柜前，"
    "圆脸方框眼镜、戴礼帽、穿长衫马褂、手里拿着算盘，表情严肃又有点慈祥。"
    "右侧是暗色对话框，上面写着中文楷体字。"
    "背景是木药柜、铜秤、账本。色调是纸白、墨青、朱砂、淡金海派色。"
    "30年代海派风格，无水印无LOGO无现代元素，电影感构图，超精细细节。"
)

NPC_ANGRY_PROMPT = (
    "1936年上海五洲大药房掌柜肖像，圆脸方框眼镜戴礼帽穿长衫马褂的中年人，"
    "眉头紧锁、怒目而视、手握算盘用力拍桌子，表情极其愤怒。"
    "背景是木药柜模糊。色调纸白、墨青、朱砂、淡金海派色。"
    "无水印无LOGO无现代元素，肖像特写，超精细细节。"
)

TASKS = [
    {
        "name": "cover",
        "prompt": COVER_PROMPT,
        "aspect": "16:9",
        "out": os.path.join(OUT_DIR, "cover.png"),
    },
    {
        "name": "dialogue-scene",
        "prompt": DIALOGUE_PROMPT,
        "aspect": "16:9",
        "out": os.path.join(OUT_DIR, "dialogue-scene.png"),
    },
    {
        "name": "npc-angry",
        "prompt": NPC_ANGRY_PROMPT,
        "aspect": "1:1",
        "out": os.path.join(OUT_DIR, "npc-angry.png"),
    },
]


def main():
    t_start = time.time()
    results = {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        futs = {
            pool.submit(gen, t["prompt"], t["aspect"], t["out"]): t["name"]
            for t in TASKS
        }
        for fut in as_completed(futs):
            name = futs[fut]
            try:
                results[name] = fut.result()
            except Exception as e:  # noqa: BLE001
                results[name] = {
                    "path": TASKS_BY_NAME[name]["out"],
                    "size": 0,
                    "status": "fail",
                    "error": f"submit-exception: {e!r}",
                }
    total_elapsed = round(time.time() - t_start, 2)
    report = {
        "total_elapsed_sec": total_elapsed,
        "results": results,
    }
    print("\n========== REPORT ==========")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return report


TASKS_BY_NAME = {t["name"]: t for t in TASKS}


if __name__ == "__main__":
    main()
