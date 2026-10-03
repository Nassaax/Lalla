#!/usr/bin/env python3
"""LALLAT : bande-son originale du reel « propriétaires » (synthèse, aucun échantillon externe).

Groove gnaoua (qraqeb en triolets, guembri, claquements de mains), oud pentatonique, notifications,
pièces qui tintent à chaque versement et effets calés sur le montage (120 battements par minute, 24 s).
Usage : python3 scripts/bande-son-proprietaires.py marque/video/reel-proprietaires-son.wav
"""
import sys
import numpy as np
from synthe import (NOTES, Mixage, alea, bendir, clap, cloche, declic, doum, fermeture, guembri, humain, impact,
                    montee, oud, qraqeb)

TEMPS = 0.5
TRIOLET = TEMPS / 3
m = Mixage(24.0)
poser = m.poser

GUEMBRI_A = [(0, 'D2', 2), (3, 'D2', 1), (5, 'F2', 1), (6, 'G2', 2), (9, 'A2', 1), (11, 'G2', 1)]
GUEMBRI_B = [(0, 'D2', 2), (3, 'C3', 1), (5, 'A2', 1), (6, 'G2', 2), (9, 'F2', 1), (11, 'D2', 1)]
OUD_A = [(0, 'A4', 2), (2, 'C5', 1), (3, 'D5', 3), (6, 'C5', 1), (7, 'A4', 1), (8, 'G4', 1), (9, 'A4', 3)]
OUD_B = [(0, 'F4', 2), (2, 'G4', 1), (3, 'A4', 3), (6, 'G4', 1), (7, 'F4', 1), (8, 'D4', 1), (9, 'D4', 3)]


def ligne_guembri(motif, t0, v=1.0):
    for pas, note, duree in motif:
        poser(guembri(note, duree * TRIOLET * 1.15, v), humain(t0 + pas * TRIOLET), 1, -.05, .12)


def ligne_oud(motif, t0, v=1.0):
    for pas, note, duree in motif:
        t = humain(t0 + pas * TRIOLET)
        if duree >= 3:  # note tenue : trémolo
            for r in range(6):
                poser(oud(note, .2, (.9 if r == 0 else .5) * v), t + r * TRIOLET / 2, 1, .25, .3)
        else:
            poser(oud(note, .5, v), t, 1, .25, .3)


def groove(debut, mesures, intensite=1.0, guembri_on=True, oud_motifs=None):
    for k in range(mesures):
        t0 = debut + k * 4 * TEMPS
        for b in range(4):
            tb = t0 + b * TEMPS
            poser(qraqeb(alea.uniform(.9, 1)), humain(tb), .9 * intensite, -.35, .15)
            poser(qraqeb(alea.uniform(.45, .6)), humain(tb + 2 * TRIOLET), .8 * intensite, .35, .15)
            if b == 3 and k % 2:
                poser(qraqeb(.5), humain(tb + TRIOLET), .7 * intensite, 0, .15)
            if b in (1, 3):
                poser(clap(alea.uniform(.9, 1)), humain(tb), .5 * intensite, alea.uniform(-.3, .3), .35)
        poser(doum(1), t0, .9 * intensite, 0, .12)
        poser(doum(.6), t0 + 2 * TEMPS + 2 * TRIOLET, .7 * intensite, 0, .12)
        poser(bendir(), t0, .35 * intensite, 0, .2)
        if guembri_on:
            ligne_guembri(GUEMBRI_A if k % 2 == 0 else GUEMBRI_B, t0, intensite)
        if oud_motifs:
            ligne_oud(oud_motifs[k % len(oud_motifs)], t0, .8 * intensite)


def roulement_qraqeb(t0, t1, v0=.3, v1=1.0):
    n = int((t1 - t0) / TRIOLET)
    for r in range(n):
        poser(qraqeb(v0 + (v1 - v0) * r / max(1, n - 1)), t0 + r * TRIOLET, 1, -.3 if r % 2 else .3, .15)


# A. L'armoire (0 à 2,5 s)
ligne_guembri(GUEMBRI_A, 0.0, .9)
for b in range(1, 4):
    poser(qraqeb(.5), .0 + b * TEMPS, .6, -.3, .15)
m.souffle(1.05, .55, 250, 2600, 1, .45, rev=.2)
poser(impact(.45, bois=True), 1.62, .5, 0, .4)
m.tiroir_caisse(1.33, .9)
m.scintillement(1.3, ['D6', 'F6', 'A6', 'D7'], .05, .7)
groove(2.0, 1, .9, oud_motifs=[OUD_A])
poser(montee(.6, .45), 1.85, 1, 0, .25)
m.souffle(2.4, .5, 400, 5000, -1, .45, rev=.2)
poser(impact(.5), 2.5, .45, 0, .45)

# B. La housse (2,5 à 5,1 s)
poser(fermeture(.72, 1.0), 3.35, .8, 0, .2)
m.scintillement(4.08, ['D6', 'A6', 'D7'], .05, .6)
poser(impact(.5), 4.2, .5, 0, .45)
for i, n in enumerate(['D4', 'F4', 'G4', 'A4', 'C5', 'D5']):
    poser(oud(n, .3, .8), 4.2 + i * TRIOLET / 2, 1, .25, .3)
groove(4.0, 1, .95, oud_motifs=[OUD_B])
m.souffle(5.05, .5, 250, 3500, 1, .5, rev=.2)

# C. Le téléphone (5,1 à 11,1 s)
groove(6.0, 2, 1.0, oud_motifs=[OUD_A, OUD_B])
groove(10.0, 1, .9)
for t in (5.45, 6.9, 8.6):
    m.souffle(t - .05, .28, 700, 4500, 1, .18)
for t in (5.95, 7.15, 7.75):
    m.notification(t, .9)
for t in (8.95, 9.55, 10.15):
    m.notification(t, .7)
    m.tiroir_caisse(t + .02, 1.0)
poser(montee(.35, .5), 10.7, 1, 0, .25)
m.souffle(10.75, .4, 400, 6000, -1, .45, rev=.2)
poser(impact(.8), 11.05, .75, 0, .5)

# D. Le compteur (11,1 à 15,1 s)
m.nappe(11.1, 3.0, ['D3', 'A3', 'D4', 'F4'], .16)
for b in range(8):
    poser(qraqeb(.5 if b % 2 else .8), 11.0 + b * TEMPS, .7, -.3 if b % 2 else .3, .15)
for i, n in enumerate(['A5', 'D6', 'F6']):
    poser(cloche(NOTES[n], .9, .8), 11.57 + i * .12, 1, (i - 1) * .5, .4)
    m.souffle(11.95 + i * .15, .32, 900, 5000, -1 if i % 2 else 1, .2)
for k in range(1, 25):
    x = 1 - (1 - k / 24) ** (1 / 3)
    poser(declic(.8), 12.15 + x * 1.55, .55, alea.uniform(-.2, .2), .05)
poser(impact(.9), 13.62, .8, 0, .5)
m.tiroir_caisse(13.62, 1.1)
m.scintillement(13.62, ['D6', 'F6', 'G6', 'A6', 'C7', 'D7'], .04, .9)
groove(14.0, 1, .95, oud_motifs=[OUD_A])
m.souffle(15.1, .5, 400, 5000, 1, .45, rev=.2)

# E. Protection (15,15 à 19,1 s)
groove(16.0, 1, .8, oud_motifs=[OUD_B])
for i, n in enumerate(['D5', 'F5', 'G5', 'A5']):
    t = 16.2 + i * .4
    poser(cloche(NOTES[n] * 2, 1.0, .7), t, 1, -.3, .45)
    poser(oud(n, .45, .6), t, 1, -.3, .3)
groove(18.0, 1, .85, guembri_on=True)
roulement_qraqeb(18.5, 19.1, .3, 1.0)

# F. Final (19,1 à 24 s)
m.souffle(19.1, .55, 300, 6000, -1, .5, rev=.25)
poser(montee(.65, .55), 19.13, 1, 0, .3)
poser(impact(1.0), 19.78, 1.0, 0, .55)
m.scintillement(19.78, ['D6', 'F6', 'G6', 'A6', 'C7', 'D7'], .035, 1.0)
m.tiroir_caisse(19.8, .9)
groove(20.0, 1, .9, oud_motifs=[OUD_A])
poser(doum(1), 22.0, 1.1, 0, .4); poser(bendir(), 22.0, .9, 0, .4); poser(clap(1), 22.0, .7, 0, .5)
poser(guembri('D2', 1.6, 1.1), 22.0, 1, 0, .3)
for i, n in enumerate(['D3', 'A3', 'D4', 'F4', 'A4', 'D5']):
    poser(oud(n, 1.6, .8), 22.0 + i * .018, 1, -.3 + i * .12, .5)
m.scintillement(22.0, ['D6', 'F6', 'A6', 'D7'], .06, .8)

m.ecrire(sys.argv[1] if len(sys.argv) > 1 else 'reel-proprietaires-son.wav')
print('Bande-son écrite :', m.duree, 's')
