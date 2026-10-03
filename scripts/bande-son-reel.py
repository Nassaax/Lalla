#!/usr/bin/env python3
"""LALLAT : bande-son originale du reel festif (synthèse, aucun échantillon externe).

Groove de darbouka (maqsoum), claquements de mains, riq, bendir, oud en mode hijaz et effets calés
sur le montage (120 battements par minute, 22 s). Les instruments sont dans scripts/synthe.py.
Usage : python3 scripts/bande-son-reel.py marque/video/reel-festif-son.wav
"""
import sys
import numpy as np
from synthe import (NOTES, Mixage, alea, basse, bendir, biquad, bruit, clap, cloche, doum, humain, impact,
                    montee, oud, riq, tek, temps)

TEMPS = 0.5          # un temps à 120 BPM
DOUBLE = TEMPS / 4   # double croche
m = Mixage(22.0)
poser = m.poser

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
m.scintillement(0.0, ['D6', 'F#6', 'A6'], .05, .8)
riff(RIFF_A, 0.0, .9)
poser(bendir(), 0.0, .6, 0, .25); poser(bendir(), 1.0, .5, 0, .25)
for pos in (6, 14):
    poser(tek(.7), pos * DOUBLE, .7, .15, .2)
for pos in range(8, 12):
    poser(riq(.3 + pos * .03), pos * DOUBLE, .3, .45, .1)
m.scintillement(1.0, ['A6', 'D7'], .06, .5)
roulement(1.5, 1.98, .2, .9)

# 2 à 4 s : portes, tension, ouverture
m.souffle(1.93, .4, 300, 3000, 1, .6, rev=.2)
poser(impact(1.0, bois=True), 2.32, .95, 0, .45)
m.nappe(2.35, 1.3, ['D3', 'A3'], .25)
poser(montee(.95, .55), 2.6, 1, 0, .25)
tremolo('D4', 2.9, 3.5, .15, .8)
poser(impact(.5), 3.6, .5, 0, .5)
m.scintillement(3.6, ['D6', 'Eb6', 'F#6', 'G6', 'A6', 'D7'], .04, .9)
m.souffle(3.5, .5, 500, 6000, -1, .45, rev=.2)
roulement(3.75, 3.99, .5, .9)

# 4 à 9,5 s : groove (photo, occasions, triptyque)
groove(4.0, 3)
riff(RIFF_B, 4.0); riff(RIFF_A, 6.0); riff(RIFF_C, 8.0)
for i in range(5):
    m.souffle(4.86 + i * .5, .28, 600, 5000, 1 if i % 2 else -1, .22)
m.scintillement(5.0, ['A6', 'D7'], .05, .45)
m.souffle(7.42, .4, 400, 4000, 1, .35)
m.scintillement(7.6, ['D7', 'A6', 'F#6', 'D6'], .07, .4)
m.souffle(9.3, .5, 250, 3500, -1, .5, rev=.2)

# 9,5 à 12 s : la Belgique en constellation (respiration)
poser(doum(1), 9.5, 1, 0, .3); poser(clap(1), 9.5, .6, 0, .4); poser(bendir(), 9.5, .7, 0, .3)
m.nappe(9.55, 2.4, ['D3', 'A3', 'D4', 'F#4'], .35)
poser(bendir(.8), 10.0, .5, 0, .3); poser(bendir(.8), 11.0, .5, 0, .3)
for pos in range(0, 16, 2):
    poser(riq(.35), 10.0 + pos * DOUBLE, .22, .45, .2)
poser(cloche(NOTES['D6'], 2.0, 1.1), 10.25, 1, 0, .6)
for i, n in enumerate(['Eb6', 'F#6', 'G6', 'A6', 'Bb6', 'C7', 'D7', 'A6']):
    poser(cloche(NOTES[n], 1.4, .7), 10.85 + i * .06, 1, alea.uniform(-.6, .6), .6)
poser(montee(.6, .6), 11.25, 1, 0, .3)
poser(impact(.8), 11.85, .75, 0, .5)
m.scintillement(11.85, ['D6', 'A6', 'D7'], .04, .6)

# 12 à 16 s : confiance et fournisseuses
groove(12.0, 2)
riff(RIFF_A, 12.0); riff(RIFF_B, 14.0)
for i, n in enumerate(['A5', 'D6', 'F#6']):
    poser(cloche(NOTES[n], 1.0, .8), 12.62 + i * .3, 1, (i - 1) * .4, .4)
    poser(oud(['A4', 'D5', 'F#5'][i], .4, .6), 12.62 + i * .3, 1, (i - 1) * .4, .3)
m.souffle(13.9, .5, 400, 5000, -1, .45, rev=.2)
m.souffle(15.42, .25, 800, 4000, 1, .2)
m.scintillement(15.72, ['D6', 'F#6', 'A6', 'D7'], .05, .7)

# 16 à 18 s : montée finale et logo
groove(16.0, 1, .9)
roulement(16.5, 16.98, .3, 1.0)
tremolo('D4', 16.5, 16.98, .3, .9)
m.souffle(16.92, .55, 300, 6000, 1, .5, rev=.25)
poser(bendir(), 17.0, .7, 0, .35)
poser(montee(.7, .55), 17.02, 1, 0, .3)
poser(impact(1.0), 17.72, 1.0, 0, .55)
m.scintillement(17.72, ['D6', 'Eb6', 'F#6', 'G6', 'A6', 'Bb6', 'C7', 'D7'], .035, 1.0)
for i, n in enumerate(['D4', 'Eb4', 'F#4', 'G4', 'A4', 'Bb4', 'C5']):
    poser(oud(n, .3, .8), 17.72 + i * DOUBLE / 2, 1, -.25, .3)
tremolo('D5', 18.0, 18.5, 1.0, .5)

# 18 à 22 s : groove de fin, accord final et résonance
groove(18.0, 1, .85)
riff(RIFF_A, 18.5, .7)
m.scintillement(18.8, ['A6', 'D7'], .08, .4)
poser(cloche(NOTES['A6'], 1.2, .7), 19.42, 1, .3, .5)
poser(doum(1), 20.0, 1.1, 0, .4); poser(bendir(), 20.0, .9, 0, .4); poser(clap(1), 20.0, .7, 0, .5)
poser(basse(73.42, 1.2), 20.0, .6)
for i, n in enumerate(['D3', 'A3', 'D4', 'F#4', 'A4', 'D5']):
    poser(oud(n, 1.6, .8), 20.0 + i * .018, 1, -.3 + i * .12, .5)
m.scintillement(20.0, ['D6', 'F#6', 'A6', 'D7'], .06, .8)
poser(biquad(bruit(2.0), 'ph', 5500) * np.exp(-temps(2.0) * 2.2) * .18, 20.0, 1, 0, .5)

m.ecrire(sys.argv[1] if len(sys.argv) > 1 else 'reel-festif-son.wav')
print('Bande-son écrite :', m.duree, 's')
