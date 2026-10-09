#!/usr/bin/env python3
"""LALLAT : bande-son originale du reel de prélancement (25 s, 120 BPM, ré mineur), synthèse pure, aucun échantillon externe.

Accroche en tension (cœur qui bat, filet de lumière), portes qui s'ouvrent, montée vers le logo (temps fort à 6,5 s),
groove gnaoua moderne (doum, clap, qraqeb, guembri, basse, oud), coupure sur « Prélancement », quatre coups sur
« Les inscriptions sont ouvertes » (18 s), inscription puis écran final.
Usage : python3 scripts/bande-son-prelancement.py sortie.wav
"""
import sys
import numpy as np
from synthe import NOTES, Mixage, alea, basse, bendir, clap, cloche, declic, doum, guembri, humain, impact, montee, oud, qraqeb, riq, tek

NOTES.update({'F3': 174.61, 'G3': 196.0, 'Bb3': 233.08, 'E4': 329.63, 'E5': 659.25, 'C6': 1046.5, 'E6': 1318.51})
DUREE = 25.0
B = .5  # un temps
BASSES = ['D2', 'D2', 'F2', 'C3']
GUEMBRI = [[(0, 'D2'), (1.5, 'D2'), (2, 'F2'), (2.5, 'G2'), (3, 'A2'), (3.5, 'G2')],
           [(0, 'D2'), (1.5, 'D2'), (2, 'C3'), (2.5, 'A2'), (3, 'G2'), (3.5, 'F2')]]
OUD = [[(0, 'D5', 1), (1, 'C5', 1), (2, 'A4', 2), (5, 'G4', 1), (6, 'A4', 2)],
       [(0, 'F4', 1), (1, 'G4', 1), (2, 'A4', 2), (5, 'C5', 1), (6, 'D5', 2)]]


def groove(m, debut, fin, intensite=1.0, oud_on=True, qraqeb_on=True, guembri_on=True, basse_on=True):
    """Mesures de quatre temps : doum, clap, riq en croches, qraqeb en doubles croches, guembri, basse, oud."""
    k, t0 = 0, debut
    while t0 < fin - .01:
        for b in range(4):
            tb = t0 + b * B
            if tb >= fin:
                break
            if b in (0, 2):
                m.poser(doum(1), humain(tb), .95 * intensite, 0, .1)
            if b in (1, 3):
                m.poser(clap(alea.uniform(.85, 1)), humain(tb), .55 * intensite, alea.uniform(-.2, .2), .3)
                m.poser(tek(.7), humain(tb), .32 * intensite, .2, .15)
            m.poser(riq(.5), humain(tb + B / 2), .42 * intensite, .35, .1)
            if qraqeb_on:
                for q in range(4):
                    if tb + q * B / 4 < fin:
                        m.poser(qraqeb(.8 if q % 2 == 0 else .45), humain(tb + q * B / 4), .3 * intensite, -.35, .08)
        if t0 + 2.5 * B < fin:
            m.poser(doum(.6), humain(t0 + 2.5 * B), .7 * intensite, 0, .1)
        if basse_on:
            n = NOTES[BASSES[k % 4]]
            m.poser(basse(n, B * 1.6, .9), t0, .5 * intensite, 0, .05)
            if t0 + 2.5 * B < fin:
                m.poser(basse(n, B * .9, .7), t0 + 2.5 * B, .4 * intensite, 0, .05)
        if guembri_on:
            for pas, note in GUEMBRI[k % 2]:
                tt = t0 + pas * B
                if tt < fin:
                    m.poser(guembri(note, .42, .9), humain(tt), .75 * intensite, -.1, .12)
        if oud_on:
            for pas, note, d in OUD[k % 2]:
                tt = t0 + pas * B / 2
                if tt < fin:
                    m.poser(oud(note, .45 * d, .75), humain(tt), .7 * intensite, .25, .3)
        t0 += 4 * B
        k += 1


def coup(m, t, force=1.0, bois=False):
    """Mot qui claque : impact, doum, clap."""
    m.poser(impact(.8 * force, bois), t, .75 * force, 0, .4)
    m.poser(doum(1), t, .9 * force, 0, .2)
    m.poser(clap(1), t, .45 * force, 0, .35)


def roulement(m, t0, t1, v=.6):
    """Roulement de darbouka qui accélère (croches, doubles, triples croches)."""
    t, pas = t0, B / 2
    while t < t1:
        progres = (t - t0) / (t1 - t0)
        m.poser(tek(.5 + .5 * progres, 1 + .3 * progres), t, v * (.4 + .8 * progres), alea.uniform(-.3, .3), .15)
        if progres > .5:
            m.poser(doum(.5), t, .35 * progres, 0, .1)
        t += pas
        pas = B / 2 if progres < .45 else B / 4 if progres < .75 else B / 8


def piano_de_points(m, t0, t1, n, v=.18):
    """Pluie de petites notes cristallines (les points d'or qui volent)."""
    gammes = ['D6', 'F6', 'G6', 'A6', 'C7', 'D7']
    for _ in range(n):
        t = alea.uniform(t0, t1)
        m.poser(cloche(NOTES[gammes[alea.integers(0, len(gammes))]], .7, v), t, 1, alea.uniform(-.8, .8), .5)


def bande_son(m):
    # ------------------------------------------------ A. L'armoire (0 à 3,5 s)
    m.nappe(0, 3.6, ['D3', 'A3', 'F4'], .24)
    m.souffle(0, 2.4, 2500, 7000, 1, .08, rev=.3)  # filet de lumière
    coup(m, 0.0, 1.0)
    m.poser(bendir(1), 0.0, .9, 0, .3)
    m.poser(tek(.8), .1, .45, .2, .2); m.poser(clap(.7), .1, .3, 0, .3)
    for t in (.5, 1.0, 1.5, 2.0):
        m.poser(doum(.8), t, .75, 0, .15)  # cœur qui bat
        m.poser(riq(.3), t + .25, .22, .3, .1)
    m.souffle(1.1, .3, 500, 5000, -1, .35, rev=.15)
    for t in (1.34, 1.46, 1.6):
        m.poser(tek(1), t, .55, .2, .2); m.poser(impact(.35), t, .3, 0, .3)
    m.poser(clap(.9), 1.6, .4, 0, .4)
    # L'armoire tremble, puis s'ouvre
    m.poser(montee(.5, .6), 2.05, 1, 0, .25)
    for i, t in enumerate((2.24, 2.32, 2.39, 2.45, 2.5)):
        m.poser(doum(.6 + i * .08), t, .5 + i * .08, 0, .1)
        m.poser(qraqeb(.7), t, .3, -.3, .1)
    m.poser(impact(1.0, bois=True), 2.55, 1.0, 0, .5)
    m.poser(bendir(1), 2.55, .9, 0, .4)
    m.souffle(2.4, .55, 300, 6500, 1, .55, rev=.25)
    m.scintillement(2.57, ['D6', 'F6', 'A6', 'C7', 'D7'], .04, 1.0)
    m.poser(cloche(NOTES['D5'], 2.0, .7), 2.58, 1, 0, .6)
    m.nappe(2.55, 1.6, ['D4', 'F4', 'A4', 'D5'], .22)
    # Plongée dans l'arche, puis travelling arrière
    m.souffle(3.02, .55, 400, 7500, 1, .6, rev=.2)
    m.poser(montee(.45, .5), 3.05, 1, 0, .2)
    m.souffle(3.48, .5, 6000, 300, -1, .45, rev=.2)
    m.poser(impact(.5), 3.55, .45, 0, .3)

    # ------------------------------------------------ B. Façade, Belgique, logo (3,5 à 8,0 s)
    coup(m, 3.72, .8)
    m.poser(tek(.9), 3.98, .5, -.2, .2)
    for i, n in enumerate(['A5', 'C6', 'D6', 'F6', 'A6']):
        m.poser(cloche(NOTES[n], .9, .55), 3.86 + i * .09, 1, (i - 2) * .35, .45)
    groove(m, 4.0, 4.96, .55, oud_on=False, basse_on=False)
    m.souffle(4.9, .35, 6000, 600, 1, .4, rev=.2)
    coup(m, 5.14, .7)
    m.poser(tek(.9), 5.32, .45, .2, .2)
    piano_de_points(m, 5.05, 5.95, 26, .14)
    for i, n in enumerate(['D6', 'F6', 'A6', 'C7', 'D7', 'F6']):
        m.poser(cloche(NOTES[n], .9, .55), 5.5 + i * .06, 1, (i - 2.5) * .3, .45)
    m.poser(montee(1.2, .75), 5.3, 1, 0, .25)
    roulement(m, 5.5, 6.44, .55)
    m.souffle(6.24, .26, 800, 7000, -1, .5, rev=.1)  # aspiration de la carte
    # Temps fort : le logo
    m.poser(impact(1.0), 6.5, 1.05, 0, .55)
    m.poser(bendir(1), 6.5, 1.0, 0, .3)
    m.poser(basse(NOTES['D2'], 1.2, 1), 6.5, .7, 0, .05)
    m.scintillement(6.52, ['D6', 'F6', 'G6', 'A6', 'C7', 'D7'], .035, 1.0)
    groove(m, 6.5, 16.0, .9)

    # ------------------------------------------------ C. Pour qui ? (8,0 à 16,0 s)
    m.souffle(7.78, .4, 400, 6500, -1, .5, rev=.15)  # coup de fouet
    coup(m, 8.06, .7)
    m.souffle(8.4, .55, 300, 5500, 1, .45, rev=.2)  # le prisme arrive en tournant
    for t, n in ((8.95, 'D6'), (11.12, 'F6'), (13.52, 'A6')):
        m.poser(cloche(NOTES[n], 1.0, .6), t, 1, .2, .45)
        m.poser(tek(.8, 1.2), t, .35, -.2, .2)
    for t, sens in ((10.9, -1), (13.3, 1)):
        m.souffle(t, .62, 350, 5000, sens, .45, rev=.2)
        m.poser(impact(.45, bois=True), t + .55, .4, 0, .3)
    for i in range(4):
        m.poser(declic(1), 13.62 + i * .09, .6, (i - 1.5) * .3, .1)
    for i, n in enumerate(['D6', 'F6', 'G6', 'A6', 'D7']):
        m.poser(tek(.6, 1.5), 14.0 + i * .1, .35, (i - 2) * .35, .2)
        m.poser(cloche(NOTES[n], .6, .4), 14.0 + i * .1, 1, (i - 2) * .35, .4)
    m.poser(montee(.45, .5), 15.5, 1, 0, .2)
    m.souffle(15.62, .38, 400, 7000, 1, .5, rev=.15)

    # ------------------------------------------------ D. Prélancement (16,0 à 19,6 s)
    coup(m, 16.02, .9)
    m.poser(impact(1.0, bois=True), 16.12, .95, 0, .5)
    m.poser(bendir(1), 16.12, .8, 0, .3)
    m.nappe(16.0, 1.25, ['D3', 'Eb4', 'A3', 'F4'], .3)
    m.poser(montee(1.05, .8), 16.12, 1, 0, .25)
    m.souffle(16.2, .95, 300, 6000, 1, .3, rev=.2)  # le sceau tourne de plus en plus vite
    for t in (16.5, 16.75, 17.0, 17.08):
        m.poser(doum(.9), t, .7, 0, .1)
    for t in (17.25, 17.5, 17.75):  # « Les », « inscriptions », « sont »
        coup(m, t, .8)
    coup(m, 18.0, 1.1)  # « ouvertes. »
    m.poser(bendir(1), 18.0, 1.0, 0, .3)
    m.poser(basse(NOTES['D2'], 1.2, 1), 18.0, .7, 0, .05)
    m.scintillement(18.02, ['D6', 'F6', 'A6', 'C7', 'D7'], .04, 1.0)
    groove(m, 18.0, 19.5, .95)
    m.souffle(19.4, .45, 400, 7000, 1, .5, rev=.2)
    m.poser(impact(.55), 19.6, .5, 0, .35)

    # ------------------------------------------------ E. Inscription (19,6 à 22,1 s)
    groove(m, 19.6, 22.0, .62, qraqeb_on=False, guembri_on=False)
    coup(m, 19.8, .55)
    for t in (20.35, 20.75, 21.15):
        m.poser(declic(1.2), t, .8, 0, .05)
        m.poser(cloche(NOTES['A6'], .5, .5), t + .02, 1, .2, .3)
    m.poser(declic(1.3), 21.62, .9, 0, .05)
    m.notification(21.66, .8)
    m.scintillement(21.7, ['F6', 'A6', 'C7', 'D7'], .04, .8)
    m.poser(montee(.5, .5), 21.65, 1, 0, .2)

    # ------------------------------------------------ Final (22,1 à 25 s)
    m.souffle(22.1, .55, 300, 6000, -1, .5, rev=.25)
    m.poser(impact(1.0), 22.7, 1.0, 0, .55)
    m.poser(bendir(1), 22.7, .8, 0, .3)
    m.scintillement(22.7, ['D6', 'F6', 'G6', 'A6', 'C7', 'D7'], .035, 1.0)
    groove(m, 22.7, 23.7, .8, guembri_on=False)
    t = 23.7
    m.poser(doum(1), t, 1.1, 0, .4); m.poser(bendir(1), t, .9, 0, .4); m.poser(clap(1), t, .6, 0, .5)
    m.poser(basse(NOTES['D2'], 1.3, 1), t, .7, 0, .1)
    for i, n in enumerate(['D3', 'A3', 'D4', 'F4', 'A4', 'D5']):
        m.poser(oud(n, 1.3, .8), t + i * .018, 1, -.3 + i * .12, .5)
    m.scintillement(t, ['D6', 'F6', 'A6', 'D7'], .06, .8)
    m.nappe(23.7, 1.3, ['D4', 'F4', 'A4'], .2)


if __name__ == '__main__':
    m = Mixage(DUREE)
    bande_son(m)
    m.ecrire(sys.argv[1])
    print('Bande-son écrite :', sys.argv[1])
