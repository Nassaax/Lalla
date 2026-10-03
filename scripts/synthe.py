"""LALLAT : petit moteur de synthèse pour les bandes-son des vidéos (aucun échantillon externe).

Percussions marocaines (darbouka, bendir, riq, qraqeb), cordes pincées Karplus-Strong (oud, guembri),
carillons, effets (souffles, montées, impacts, pièces) et mixage avec réverbération par convolution.
"""
import wave
import numpy as np

SR = 48000
alea = np.random.default_rng(7)

NOTES = {'D2': 73.42, 'F2': 87.31, 'G2': 98.0, 'A2': 110.0, 'C3': 130.81, 'D3': 146.83, 'A3': 220.0,
         'C4': 261.63, 'D4': 293.66, 'Eb4': 311.13, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.0, 'A4': 440.0, 'Bb4': 466.16,
         'C5': 523.25, 'D5': 587.33, 'Eb5': 622.25, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'A5': 880.0,
         'D6': 1174.66, 'Eb6': 1244.51, 'F6': 1396.91, 'F#6': 1479.98, 'G6': 1567.98, 'A6': 1760.0, 'Bb6': 1864.66,
         'C7': 2093.0, 'D7': 2349.32}


def temps(n):
    return np.arange(int(n * SR)) / SR


def bruit(n):
    return alea.uniform(-1, 1, int(n * SR))


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


def qraqeb(v=1.0):
    """Castagnettes de fer gnaoua : deux plaques qui claquent presque ensemble."""
    t = temps(.12)
    choc = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, a, d in [(2350, 1, 55), (3480, .8, 65), (4920, .55, 80), (6800, .35, 95)])
    choc += biquad(bruit(.12), 'bp', 4200, 1.1) * np.exp(-t * 150) * 1.2
    s = choc.copy()
    decale = int(.011 * SR)
    s[decale:] += choc[:-decale] * .6
    s[:24] *= np.linspace(0, 1, 24)
    return s * v * .4


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


def declic(v=1.0):
    """Petit clic sec (rouleaux d'un compteur)."""
    t = temps(.03)
    return (np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 260) + biquad(bruit(.03), 'ph', 3000) * np.exp(-t * 400) * .6) * v


# ---------------------------------------------------------------- cordes et carillons
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


def guembri(note, duree=.45, v=1.0):
    """Luth basse gnaoua : corde grave pincée, avec le grésillement de la peau."""
    f = NOTES[note]
    s = corde(f, duree, 1, .998) + .5 * corde(f * 2.003, duree, 1, .996)
    s = np.tanh(s * 2.2)
    t = temps(duree)
    s += biquad(bruit(duree), 'bp', 900, 1.2) * np.exp(-t * 30) * .25
    return s * v * .42


def cloche(f, duree=1.6, v=1.0):
    t = temps(duree)
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in [(1, 1, 2.6), (2.0, .45, 3.8), (2.76, .3, 5), (4.07, .16, 7), (5.4, .1, 9)])
    s[:96] *= np.linspace(0, 1, 96)
    return s * v * .35


def piece(v=1.0):
    """Tintement de pièce métallique."""
    t = temps(.35)
    s = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, a, d in [(3150, 1, 14), (4630, .7, 18), (6120, .5, 24), (8330, .35, 30)])
    s += biquad(bruit(.35), 'ph', 6000) * np.exp(-t * 90) * .5
    s[:24] *= np.linspace(0, 1, 24)
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


def fermeture(duree, v=1.0):
    """Fermeture éclair : une suite de crans de plus en plus rapprochés."""
    n = int(duree * SR); s = np.zeros(n)
    t = temps(.006)
    cran = biquad(bruit(.006), 'bp', 2600, 1.4) * np.exp(-t * 600)
    pos = 0.0; ecart = .022
    while pos < duree - .01:
        i = int(pos * SR); s[i:i + len(cran)] += cran[:n - i] * alea.uniform(.6, 1)
        pos += ecart; ecart = max(.008, ecart * .965)
    s += svf(bruit(duree), np.full(n, 3200.0), 2, 'bp') * .15 * np.sin(np.pi * np.linspace(0, 1, n))
    return s * v


# ---------------------------------------------------------------- mixage
class Mixage:
    def __init__(self, duree):
        self.duree = duree; self.n = int(SR * duree)
        self.G = np.zeros(self.n); self.D = np.zeros(self.n)
        self.RG = np.zeros(self.n); self.RD = np.zeros(self.n)

    def poser(self, sig, t, gain=1.0, pan=0.0, rev=0.0, droite=None):
        """Place un son (mono, ou stéréo si `droite` est fourni) à l'instant t."""
        i = int(round(t * SR))
        if i >= self.n or i + len(sig) <= 0:
            return
        if i < 0:
            sig = sig[-i:]; droite = droite[-i:] if droite is not None else None; i = 0
        n = min(len(sig), self.n - i)
        if droite is None:
            a = (pan + 1) * np.pi / 4
            sg, sd = sig[:n] * np.cos(a) * gain, sig[:n] * np.sin(a) * gain
        else:
            sg, sd = sig[:n] * gain, droite[:n] * gain
        self.G[i:i + n] += sg; self.D[i:i + n] += sd
        if rev:
            self.RG[i:i + n] += sg * rev; self.RD[i:i + n] += sd * rev

    def souffle(self, t, duree, f0=350, f1=4500, sens=1, v=1.0, rev=0.0):
        sg, sd = souffle(duree, f0, f1, sens, v)
        self.poser(sg, t, 1, droite=sd, rev=rev)

    def scintillement(self, t0, notes, ecart=.045, v=1.0):
        for i, n in enumerate(notes):
            self.poser(cloche(NOTES[n], 1.4, v), t0 + i * ecart, 1, pan=alea.uniform(-.7, .7), rev=.55)
        for i in range(14):
            tt = temps(.03)
            self.poser(biquad(bruit(.03), 'ph', 9000) * np.exp(-tt * 160) * .5 * v, t0 + alea.uniform(0, .5), 1, pan=alea.uniform(-.9, .9), rev=.4)

    def nappe(self, t0, duree, notes, v=1.0):
        t = temps(duree)
        env = np.minimum(1, t / .9) * np.minimum(1, (duree - t) / 1.0)
        s = sum(np.sin(2 * np.pi * NOTES[n] * t) + .3 * np.sin(2 * np.pi * NOTES[n] * 1.003 * t + 1) for n in notes)
        s *= env * (1 + .15 * np.sin(2 * np.pi * 4.5 * t)) / len(notes)
        self.poser(s * v, t0, 1, -.2, rev=.6); self.poser(s * v, t0 + .011, 1, .2, rev=.6)

    def tiroir_caisse(self, t0, v=1.0):
        """Pièces qui tintent puis carillon : un versement reçu."""
        for i in range(4):
            self.poser(piece(alea.uniform(.7, 1)), t0 + i * alea.uniform(.035, .06), v, alea.uniform(-.6, .6), .35)
        self.poser(cloche(NOTES['D7'], 1.2, .9), t0 + .2, v, .2, .5)
        self.poser(cloche(NOTES['A6'], 1.2, .7), t0 + .26, v, -.2, .5)

    def notification(self, t0, v=1.0):
        self.poser(cloche(NOTES['D6'], .9, 1), t0, v * .9, -.1, .35)
        self.poser(cloche(NOTES['A6'], 1.1, 1), t0 + .085, v * .9, .1, .35)

    def ecrire(self, chemin, ir_duree=2.4, humide=.55):
        def reponse(graine):
            r = np.random.default_rng(graine)
            t = temps(ir_duree)
            ir = r.normal(0, 1, len(t)) * np.exp(-t * 3.0)
            ir = np.convolve(ir, np.ones(6) / 6, mode='same') * np.minimum(1, t / .01)  # adoucit les aigus de la queue
            return ir / np.sqrt(np.sum(ir ** 2))  # énergie unitaire

        def convoluer(x, ir):
            n = 1 << int(np.ceil(np.log2(len(x) + len(ir))))
            return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)[:len(x)]

        sortie = np.stack([self.G + convoluer(self.RG, reponse(1)) * humide, self.D + convoluer(self.RD, reponse(2)) * humide], axis=1)
        sortie[-int(.4 * SR):] *= np.linspace(1, 0, int(.4 * SR))[:, None]
        sortie /= np.max(np.abs(sortie)) / .95
        sortie = np.tanh(sortie * 1.1) / np.tanh(1.1)
        with wave.open(chemin, 'wb') as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((np.clip(sortie, -1, 1) * 32767).astype('<i2').tobytes())


def humain(t):
    return t + alea.normal(0, .004)
