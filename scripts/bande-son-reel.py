#!/usr/bin/env python3
"""LALLAT : bande-son originale du reel festif (synthèse, aucun échantillon externe).

Groove de darbouka (maqsoum), claquements de mains, riq, bendir, oud en mode hijaz (corde pincée
Karplus-Strong), carillons et effets calés sur le montage (120 battements par minute, 22 s).
Usage : python3 scripts/bande-son-reel.py marque/video/reel-festif-son.wav
"""
import sys
import wave
import numpy as np

SR = 48000
DUREE = 22.0
N = int(SR * DUREE)
TEMPS = 0.5          # un temps à 120 BPM
DOUBLE = TEMPS / 4   # double croche
alea = np.random.default_rng(7)

G = np.zeros(N); D = np.zeros(N)          # mixage sec
RG = np.zeros(N); RD = np.zeros(N)        # envoi réverbération


def poser(sig, t, gain=1.0, pan=0.0, rev=0.0, droite=None):
    """Place un son (mono, ou stéréo si `droite` est fourni) à l'instant t."""
    i = int(round(t * SR))
    if i >= N or i + len(sig) <= 0:
        return
    if i < 0:
        sig = sig[-i:]; droite = droite[-i:] if droite is not None else None; i = 0
    n = min(len(sig), N - i)
    if droite is None:
        a = (pan + 1) * np.pi / 4
        sg, sd = sig[:n] * np.cos(a) * gain, sig[:n] * np.sin(a) * gain
    else:
        sg, sd = sig[:n] * gain, droite[:n] * gain
    G[i:i + n] += sg; D[i:i + n] += sd
    if rev:
        RG[i:i + n] += sg * rev; RD[i:i + n] += sd * rev


def temps(n):
    return np.arange(int(n * SR)) / SR


def biquad(x, genre, f, q=0.707):
    w0 = 2 * np.pi * f / SR; al = np.sin(w0) / (2 * q); c = np.cos(w0)
    if genre == 'pb':
        b = [(1 - c) / 2, 1 - c, (1 - c) / 2]
    elif genre == 'ph':
        b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]
    else:  # passe-bande
        b = [al, 0.0, -al]
    a0, a1, a2 = 1 + al, -2 * c, 1 - al
    b0, b1, b2 = b[0] / a0, b[1] / a0, b[2] / a0; a1 /= a0; a2 /= a0
    y = np.zeros_like(x); x1 = x2 = y1 = y2 = 0.0
    for k in range(len(x)):
        v = b0 * x[k] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, x[k], y1, v
        y[k] = v
    return y


def svf(x, frequences, q=1.2, mode='pb'):
    """Filtre à variables d'état, fréquence de coupure variable dans le temps."""
    bas = bande = 0.0; y = np.zeros_like(x); amort = 1 / q
    for k in range(len(x)):
        f = 2 * np.sin(np.pi * min(frequences[k], SR / 6) / SR)
        haut = x[k] - bas - amort * bande
        bande += f * haut; bas += f * bande
        y[k] = bande if mode == 'bp' else bas
    return y


def bruit(n):
    return alea.uniform(-1, 1, int(n * SR))


# ---------------------------------------------------------------- percussions
def doum(v=1.0):
    t = temps(.45)
    f = 72 + 78 * np.exp(-t * 38)
    corps = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    clic = biquad(bruit(.45) * np.exp(-t * 260), 'pb', 1600) * .35
    return (corps + clic) * v


def tek(v=1.0, clair=1.0):
    t = temps(.2)
    s = sum(a * np.sin(2 * np.pi * f * clair * t) * np.exp(-t * d) for f, a, d in [(1650, 1, 48), (2730, .55, 60), (4120, .32, 75), (6300, .16, 95)])
    s += biquad(bruit(.2), 'bp', 3600, .8) * np.exp(-t * 130) * .9
    s[:48] *= np.linspace(0, 1, 48)
    return s * v * .55


def clap(v=1.0):
    t = temps(.32)
    env = sum(np.where(t >= o, np.exp(-(t - o) * 380), 0) for o in (0, .009, .019)) + np.where(t >= .024, np.exp(-(t - .024) * 26) * .55, 0)
    return biquad(bruit(.32), 'bp', 1450, .9) * env * v * 1.6


def riq(v=1.0):
    t = temps(.13)
    s = biquad(bruit(.13), 'ph', 7200) * np.exp(-t * 48)
    s += sum(.12 * np.sin(2 * np.pi * f * t) * np.exp(-t * 40) for f in (5300, 7700, 9400))
    return s * v


def bendir(v=1.0):
    t = temps(.7)
    f = 52 + 30 * np.exp(-t * 25)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5.5)
    s += biquad(bruit(.7), 'bp', 1150, .7) * np.exp(-t * 16) * .22
    return s * v


def basse(f, duree=.42, v=1.0):
    t = temps(duree)
    s = np.tanh(1.6 * np.sin(2 * np.pi * f * t)) * np.exp(-t * 5)
    s[-480:] *= np.linspace(1, 0, 480)
    return s * v


# ---------------------------------------------------------------- mélodie
NOTES = {'D3': 146.83, 'A3': 220.0, 'D4': 293.66, 'Eb4': 311.13, 'F#4': 369.99, 'G4': 392.0, 'A4': 440.0, 'Bb4': 466.16,
         'C5': 523.25, 'D5': 587.33, 'Eb5': 622.25, 'F#5': 739.99, 'G5': 783.99, 'A5': 880.0,
         'D6': 1174.66, 'Eb6': 1244.51, 'F#6': 1479.98, 'G6': 1567.98, 'A6': 1760.0, 'Bb6': 1864.66, 'C7': 2093.0, 'D7': 2349.32}


def corde(f, duree, v=1.0, perte=.996):
    """Corde pincée (Karplus-Strong), calculée période par période."""
    n = int(duree * SR); P = max(2, int(round(SR / f - .5)))
    y = np.zeros(n + P + 1)
    y[:P + 1] = np.convolve(alea.uniform(-1, 1, P + 1), np.ones(2) / 2, mode='same')
    k = P + 1
    while k < len(y):
        fin = min(k + P, len(y))
        y[k:fin] = perte * .5 * (y[k - P:fin - P] + y[k - P - 1:fin - P - 1])
        k = fin
    s = y[P + 1:P + 1 + n]
    s[-240:] *= np.linspace(1, 0, 240)
    return s * v


def oud(note, duree=.5, v=1.0):
    f = NOTES[note]
    perte = .9965 if f < 400 else .9945
    s = corde(f, duree, 1, perte) + corde(f * 1.0035, duree, .8, perte)  # double corde légèrement désaccordée
    return s * v * .55


def cloche(f, duree=1.6, v=1.0):
    t = temps(duree)
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in [(1, 1, 2.6), (2.0, .45, 3.8), (2.76, .3, 5), (4.07, .16, 7), (5.4, .1, 9)])
    s[:96] *= np.linspace(0, 1, 96)
    return s * v * .35


# ---------------------------------------------------------------- effets
def souffle(duree, f0=350, f1=4500, sens=1, v=1.0):
    n = int(duree * SR); x = np.linspace(0, 1, n)
    frq = f0 + (f1 - f0) * np.sin(np.pi * x) ** 1.5
    s = svf(bruit(duree), frq, 1.4, 'bp') * np.sin(np.pi * x) ** 2
    pan = np.linspace(-.8, .8, n) * sens
    a = (pan + 1) * np.pi / 4
    return s * np.cos(a) * v, s * np.sin(a) * v


def montee(duree, v=1.0):
    n = int(duree * SR); x = np.linspace(0, 1, n)
    s = svf(bruit(duree), 180 * (50 ** x), 1.6, 'pb') * x ** 2.2
    t = temps(duree)
    s += .18 * np.sin(2 * np.pi * np.cumsum(220 + 500 * x ** 2) / SR) * x ** 2
    return s * v


def impact(v=1.0, bois=False):
    t = temps(2.2)
    f = 44 + 80 * np.exp(-t * 18)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.4) * 1.2
    s += biquad(bruit(2.2), 'pb', 420) * np.exp(-t * 14) * .8
    s += biquad(bruit(2.2), 'ph', 5200) * np.exp(-t * 2.6) * .16
    if bois:
        s += biquad(bruit(2.2), 'bp', 230, 1.6) * np.exp(-t * 22) * 2.2
    return np.tanh(s * 1.2) * v


def scintillement(t0, notes, ecart=.045, v=1.0):
    for i, n in enumerate(notes):
        poser(cloche(NOTES[n], 1.4, v), t0 + i * ecart, 1, pan=alea.uniform(-.7, .7), rev=.55)
    for i in range(14):
        tt = temps(.03)
        poser(biquad(bruit(.03), 'ph', 9000) * np.exp(-tt * 160) * .5 * v, t0 + alea.uniform(0, .5), 1, pan=alea.uniform(-.9, .9), rev=.4)


def nappe(t0, duree, notes, v=1.0):
    t = temps(duree)
    env = np.minimum(1, t / .9) * np.minimum(1, (duree - t) / 1.0)
    s = sum(np.sin(2 * np.pi * NOTES[n] * t) + .3 * np.sin(2 * np.pi * NOTES[n] * 1.003 * t + 1) for n in notes)
    s *= env * (1 + .15 * np.sin(2 * np.pi * 4.5 * t)) / len(notes)
    poser(s * v, t0, 1, -.2, rev=.6); poser(s * v, t0 + .011, 1, .2, rev=.6)


def humain(t):
    return t + alea.normal(0, .004)


# ---------------------------------------------------------------- écriture
def groove(debut, mesures, intensite=1.0, basse_on=True):
    for m in range(mesures):
        t0 = debut + m * 4 * TEMPS
        for pos, gen in [(0, 'D'), (2, 'T'), (6, 'T'), (8, 'D'), (12, 'T'), (4, 'k'), (7, 'k'), (10, 'k'), (14, 'k'), (15, 'k')]:
            t = humain(t0 + pos * DOUBLE)
            if gen == 'D':
                poser(doum(alea.uniform(.9, 1.0)), t, 1.0 * intensite, 0, .12)
            elif gen == 'T':
                poser(tek(alea.uniform(.85, 1.0)), t, .9 * intensite, .15, .18)
            else:
                poser(tek(alea.uniform(.35, .5), .85), t, .7 * intensite, -.2, .15)
        for pos in (4, 12):
            poser(clap(alea.uniform(.9, 1)), humain(t0 + pos * DOUBLE), .55 * intensite, alea.uniform(-.3, .3), .35)
        for pos in range(16):
            poser(riq(.6 if pos % 4 == 2 else .28), humain(t0 + pos * DOUBLE), .32 * intensite, .45, .1)
        poser(bendir(), t0, .42 * intensite, 0, .2)
        if basse_on:
            poser(basse(73.42), t0, .4 * intensite)
            poser(basse(73.42, .3), t0 + 8 * DOUBLE, .45 * intensite)
            poser(basse(55.0, .22), t0 + 14 * DOUBLE, .4 * intensite)


RIFF_A = [(0, 'D4', 2), (2, 'Eb4', 1), (3, 'F#4', 1), (4, 'G4', 2), (6, 'A4', 1), (7, 'G4', 1), (8, 'F#4', 2), (10, 'Eb4', 1), (11, 'F#4', 1), (12, 'D4', 4)]
RIFF_B = [(0, 'A4', 2), (2, 'Bb4', 1), (3, 'A4', 1), (4, 'G4', 2), (6, 'F#4', 1), (7, 'G4', 1), (8, 'Eb4', 2), (10, 'F#4', 1), (11, 'Eb4', 1), (12, 'D4', 4)]
RIFF_C = [(0, 'D5', 2), (2, 'C5', 1), (3, 'Bb4', 1), (4, 'A4', 2), (6, 'G4', 1), (7, 'F#4', 1), (8, 'G4', 2), (10, 'Eb4', 1), (11, 'F#4', 1), (12, 'D4', 4)]


def riff(motif, t0, v=1.0):
    for pos, note, longueur in motif:
        t = humain(t0 + pos * DOUBLE)
        if longueur >= 4:  # note tenue : trémolo (risha)
            for r in range(8):
                poser(oud(note, .22, (.95 if r == 0 else .55) * v), t + r * DOUBLE / 2, 1, -.25, .3)
        else:
            poser(oud(note, .6, v), t, 1, -.25, .3)


def tremolo(note, t0, t1, v0=.3, v1=1.0):
    n = int((t1 - t0) / (DOUBLE / 2))
    for r in range(n):
        poser(oud(note, .2, v0 + (v1 - v0) * r / max(1, n - 1)), t0 + r * DOUBLE / 2, 1, -.25, .3)


def roulement(t0, t1, v0=.3, v1=1.0):
    n = int((t1 - t0) / (DOUBLE / 2))
    for r in range(n):
        poser(tek(v0 + (v1 - v0) * r / max(1, n - 1)), t0 + r * DOUBLE / 2, 1, .1 if r % 2 else -.1, .15)


# 0 à 2 s : accroche
scintillement(0.0, ['D6', 'F#6', 'A6'], .05, .8)
riff(RIFF_A, 0.0, .9)
poser(bendir(), 0.0, .6, 0, .25); poser(bendir(), 1.0, .5, 0, .25)
for pos in (6, 14):
    poser(tek(.7), pos * DOUBLE, .7, .15, .2)
for pos in range(8, 12):
    poser(riq(.3 + pos * .03), pos * DOUBLE, .3, .45, .1)
scintillement(1.0, ['A6', 'D7'], .06, .5)
roulement(1.5, 1.98, .2, .9)

# 2 à 4 s : portes, tension, ouverture
sg, sd = souffle(.4, 300, 3000, 1, .6); poser(sg, 1.93, 1, droite=sd, rev=.2)
poser(impact(1.0, bois=True), 2.32, .95, 0, .45)
nappe(2.35, 1.3, ['D3', 'A3'], .25)
poser(montee(.95, .55), 2.6, 1, 0, .25)
tremolo('D4', 2.9, 3.5, .15, .8)
poser(impact(.5), 3.6, .5, 0, .5)
scintillement(3.6, ['D6', 'Eb6', 'F#6', 'G6', 'A6', 'D7'], .04, .9)
sg, sd = souffle(.5, 500, 6000, -1, .45); poser(sg, 3.5, 1, droite=sd, rev=.2)
roulement(3.75, 3.99, .5, .9)

# 4 à 9,5 s : groove (photo, occasions, triptyque)
groove(4.0, 3)
riff(RIFF_B, 4.0); riff(RIFF_A, 6.0); riff(RIFF_C, 8.0)
for i in range(5):
    sg, sd = souffle(.28, 600, 5000, 1 if i % 2 else -1, .22); poser(sg, 4.86 + i * .5, 1, droite=sd)
scintillement(5.0, ['A6', 'D7'], .05, .45)
sg, sd = souffle(.4, 400, 4000, 1, .35); poser(sg, 7.42, 1, droite=sd)
scintillement(7.6, ['D7', 'A6', 'F#6', 'D6'], .07, .4)
sg, sd = souffle(.5, 250, 3500, -1, .5); poser(sg, 9.3, 1, droite=sd, rev=.2)

# 9,5 à 12 s : la Belgique en constellation (respiration)
poser(doum(1), 9.5, 1, 0, .3); poser(clap(1), 9.5, .6, 0, .4); poser(bendir(), 9.5, .7, 0, .3)
nappe(9.55, 2.4, ['D3', 'A3', 'D4', 'F#4'], .35)
poser(bendir(.8), 10.0, .5, 0, .3); poser(bendir(.8), 11.0, .5, 0, .3)
for pos in range(0, 16, 2):
    poser(riq(.35), 10.0 + pos * DOUBLE, .22, .45, .2)
poser(cloche(NOTES['D6'], 2.0, 1.1), 10.25, 1, 0, .6)
for i, n in enumerate(['Eb6', 'F#6', 'G6', 'A6', 'Bb6', 'C7', 'D7', 'A6']):
    poser(cloche(NOTES[n], 1.4, .7), 10.85 + i * .06, 1, alea.uniform(-.6, .6), .6)
poser(montee(.6, .6), 11.25, 1, 0, .3)
poser(impact(.8), 11.85, .75, 0, .5)
scintillement(11.85, ['D6', 'A6', 'D7'], .04, .6)

# 12 à 16 s : confiance et fournisseuses
groove(12.0, 2)
riff(RIFF_A, 12.0); riff(RIFF_B, 14.0)
for i, n in enumerate(['A5', 'D6', 'F#6']):
    poser(cloche(NOTES[n], 1.0, .8), 12.62 + i * .3, 1, (i - 1) * .4, .4)
    poser(oud(['A4', 'D5', 'F#5'][i], .4, .6), 12.62 + i * .3, 1, (i - 1) * .4, .3)
sg, sd = souffle(.5, 400, 5000, -1, .45); poser(sg, 13.9, 1, droite=sd, rev=.2)
sg, sd = souffle(.25, 800, 4000, 1, .2); poser(sg, 15.42, 1, droite=sd)
scintillement(15.72, ['D6', 'F#6', 'A6', 'D7'], .05, .7)

# 16 à 18 s : montée finale et logo
groove(16.0, 1, .9)
roulement(16.5, 16.98, .3, 1.0)
tremolo('D4', 16.5, 16.98, .3, .9)
sg, sd = souffle(.55, 300, 6000, 1, .5); poser(sg, 16.92, 1, droite=sd, rev=.25)
poser(bendir(), 17.0, .7, 0, .35)
poser(montee(.7, .55), 17.02, 1, 0, .3)
poser(impact(1.0), 17.72, 1.0, 0, .55)
scintillement(17.72, ['D6', 'Eb6', 'F#6', 'G6', 'A6', 'Bb6', 'C7', 'D7'], .035, 1.0)
for i, n in enumerate(['D4', 'Eb4', 'F#4', 'G4', 'A4', 'Bb4', 'C5']):
    poser(oud(n, .3, .8), 17.72 + i * DOUBLE / 2, 1, -.25, .3)
tremolo('D5', 18.0, 18.5, 1.0, .5)

# 18 à 22 s : groove de fin, accord final et résonance
groove(18.0, 1, .85)
riff(RIFF_A, 18.5, .7)
scintillement(18.8, ['A6', 'D7'], .08, .4)
poser(cloche(NOTES['A6'], 1.2, .7), 19.42, 1, .3, .5)
poser(doum(1), 20.0, 1.1, 0, .4); poser(bendir(), 20.0, .9, 0, .4); poser(clap(1), 20.0, .7, 0, .5)
poser(basse(73.42, 1.2), 20.0, .6)
for i, n in enumerate(['D3', 'A3', 'D4', 'F#4', 'A4', 'D5']):
    poser(oud(n, 1.6, .8), 20.0 + i * .018, 1, -.3 + i * .12, .5)
scintillement(20.0, ['D6', 'F#6', 'A6', 'D7'], .06, .8)
poser(biquad(bruit(2.0), 'ph', 5500) * np.exp(-temps(2.0) * 2.2) * .18, 20.0, 1, 0, .5)

# ---------------------------------------------------------------- réverbération et finition
def reponse(duree=2.4, graine=0):
    r = np.random.default_rng(graine)
    t = temps(duree)
    ir = r.normal(0, 1, len(t)) * np.exp(-t * 3.0)
    lisse = np.convolve(ir, np.ones(6) / 6, mode='same')  # adoucit les aigus de la queue
    ir = lisse * np.minimum(1, t / .01)
    return ir / np.sqrt(np.sum(ir ** 2))  # énergie unitaire


def convoluer(x, ir):
    n = 1 << int(np.ceil(np.log2(len(x) + len(ir))))
    return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)[:len(x)]


wg = convoluer(RG, reponse(2.4, 1)); wd = convoluer(RD, reponse(2.4, 2))
wg *= .55; wd *= .55
sortie = np.stack([G + wg, D + wd], axis=1)
sortie[-int(.4 * SR):] *= np.linspace(1, 0, int(.4 * SR))[:, None]
sortie /= np.max(np.abs(sortie)) / .95
sortie = np.tanh(sortie * 1.1) / np.tanh(1.1)

with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'reel-festif-son.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(sortie, -1, 1) * 32767).astype('<i2').tobytes())
print('Bande-son écrite :', DUREE, 's')
