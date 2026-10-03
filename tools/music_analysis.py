# -*- coding: utf-8 -*-
"""OMORI 原版 BGM 主旋律/音色分析（信号层，AI 无耳，纯数学）
用法: python tools/music_analysis.py            # 分析主题组并输出报告
产出: 逐曲 调性/BPM/音色描述符 + 主题间动机关联矩阵（色谱互相关）
"""
import sys, io, os, glob
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import numpy as np
import librosa

BGM = r"F:\OMORI mod\www_playtest_2c7c22ee\audio\bgm"

# 主旋律组（角色主题 + 变体 + 关联曲）
TRACKS = {
    "贝塞尔主题":   "theme_basil.ogg",
    "贝塞尔主题2":  "theme_basil2.ogg",
    "贝塞尔战斗":   "boss_basil_1.ogg",
    "马里主题":     "event_maris_theme.ogg",
    "马里·溺水":    "event_mari_drowning.ogg",
    "双人合奏":     "duet_mari.ogg",
    "独奏版合奏":   "solo_duet.ogg",
    "白色空间":     "white_space.ogg",
    "奥默战斗":     "boss_OMORI.ogg",
    "奥布里·公园":  "boss_aubrey_park.ogg",
    "奥布里·教堂":  "boss_aubrey_church_anxiety.ogg",
}

# Krumhansl-Kessler 调性轮廓
KK_MAJ = np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88])
KK_MIN = np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
NOTE = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

def key_detect(chroma):
    """色谱 → 最优调性（Krumhansl-Schmuckler 轮廓相关）"""
    best = (None, -2)
    for root in range(12):
        for prof, mode in ((KK_MAJ,'大调'), (KK_MIN,'小调')):
            rotated = np.roll(prof, root)
            r = np.corrcoef(chroma, rotated)[0, 1]
            if r > best[1]:
                best = (NOTE[root] + ' ' + mode, r)
    return best

def describe_timbre(y, sr):
    """音色客观描述符"""
    cent = librosa.feature.spectral_centroid(y=y, sr=sr).mean()          # 亮度(Hz)
    roll = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85).mean()
    flat = librosa.feature.spectral_flatness(y=y).mean()                  # 噪声性(0-1)
    rms = librosa.feature.rms(y=y).mean()
    # 谐波/打击成分比（中位）
    y_h, y_p = librosa.effects.hpss(y)
    harm_ratio = np.sqrt(np.mean(y_h**2)) / (np.sqrt(np.mean(y_p**2)) + 1e-9)
    # 主奏区八度估计：能量加权的基频中位（用谐波积谱前 20 帧）
    return dict(cent=cent, roll=roll, flat=flat, rms=float(rms), harm=harm_ratio)

def melody_notes(y, sr, top=14):
    """主旋律音高轮廓 → 音名序列（前 top 个显著稳定音）"""
    f0, voiced, _ = librosa.pyin(y, fmin=65, fmax=1050, sr=sr, frame_length=2048)
    times = librosa.times_like(f0, sr=sr)
    midi = 69 + 12 * np.log2(np.where(f0 > 0, f0, np.nan) / 440.0)
    # 连续同音合并
    seq = []
    prev = None; run = 0
    for m in midi:
        q = None if np.isnan(m) else int(round(m))
        if q == prev: run += 1
        else:
            if prev is not None and run >= 8: seq.append((prev, run))
            prev, run = q, 1
    if prev is not None and run >= 8: seq.append((prev, run))
    seq.sort(key=lambda x: -x[1])
    picked = sorted(seq[:top], key=lambda x: -x[1])
    return [(librosa.midi_to_note(m), d) for m, d in picked]

def main():
    results, chromas = {}, {}
    for label, fn in TRACKS.items():
        path = os.path.join(BGM, fn)
        if not os.path.exists(path):
            print(f"[跳过] {label}: {fn} 不存在"); continue
        y, sr = librosa.load(path, sr=22050, mono=True, duration=180)
        tempo = librosa.beat.tempo(y=y, sr=sr).mean()
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr).mean(axis=1)
        keyname, r = key_detect(chroma)
        t = describe_timbre(y, sr)
        notes = melody_notes(y, sr)
        results[label] = dict(fn=fn, dur=len(y)/sr, tempo=tempo, key=keyname, keyR=r, **t, notes=notes)
        # 动机关联用：平滑色谱序列（~5Hz 采样）
        ch = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=4096)
        chromas[label] = ch
        print(f"{label:8s} {fn:32s} {len(y)/sr:5.0f}s BPM={tempo:5.1f} 调性={keyname}(r={r:.2f}) "
              f"亮度={t['cent']:6.0f}Hz 噪声度={t['flat']:.4f} 谐/打={t['harm']:.1f}")
        print(f"         主旋律显著音: {' '.join(f'{n}({d}帧)' for n, d in notes[:8])}")

    # ---- 动机关联矩阵：两两色谱序列滑动互相关峰值 ----
    print("\n=== 主题关联（色谱序列互相关峰值，越高=共享和声/动机材料越多）===")
    names = list(chromas.keys())
    for i in range(len(names)):
        row = []
        a = chromas[names[i]]
        for j in range(len(names)):
            if i == j: row.append('  1.0'); continue
            b = chromas[names[j]]
            # 相关系数矩阵的每帧最大匹配的均值（简化：整段相关 + 平滑）
            A = (a - a.mean(axis=1, keepdims=True)); B = (b - b.mean(axis=1, keepdims=True))
            L = min(A.shape[1], B.shape[1], 300)
            corr = float(np.mean(np.sum(A[:, :L] * B[:, :L], axis=0) /
                         (np.linalg.norm(A[:, :L], axis=0) * np.linalg.norm(B[:, :L], axis=0) + 1e-9)))
            row.append(f'{corr:5.2f}')
        print(f"{names[i]:8s} " + ' '.join(row))
    print("列序: " + ' '.join(n[:4] for n in names))

if __name__ == '__main__':
    main()
