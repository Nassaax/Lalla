#!/usr/bin/env python3
"""LALLAT : bandes-son originales des trois reels « Hub fêtes & mariages » (synthèse, aucun échantillon externe).

Groove moderne aux couleurs marocaines (doum, clap, riq, basse, oud en ré mineur), effets calés sur le montage.
Usage : python3 scripts/bande-son-hub.py equipe|budget|confiance sortie.wav
"""
import sys
import numpy as np
from synthe import NOTES, Mixage, alea, basse, bendir, clap, cloche, declic, doum, impact, montee, oud, riq, tek, humain

DUREE = 15.0
BASSES = ['D2', 'D2', 'F2', 'C3']  # une note par mesure
OUD = [[(0, 'D5', 1), (1, 'C5', 1), (2, 'A4', 2), (5, 'G4', 1), (6, 'A4', 2)],
       [(0, 'F4', 1), (1, 'G4', 1), (2, 'A4', 2), (5, 'C5', 1), (6, 'D5', 2)]]


def groove(m, debut, fin, temps, intensite=1.0, oud_on=True, basse_on=True):
    """Mesures de 4 temps entre debut et fin : doum, clap, riq en croches, basse et oud."""
    k = 0
    t0 = debut
    while t0 < fin - .01:
        for b in range(4):
            tb = t0 + b * temps
            if tb >= fin:
                break
            if b in (0, 2):
                m.poser(doum(1), humain(tb), .95 * intensite, 0, .1)
            if b in (1, 3):
                m.poser(clap(alea.uniform(.85, 1)), humain(tb), .55 * intensite, alea.uniform(-.2, .2), .3)
                m.poser(tek(.7), humain(tb), .35 * intensite, .2, .15)
            m.poser(riq(.5), humain(tb + temps / 2), .45 * intensite, .35, .1)
            m.poser(riq(.25), humain(tb), .3 * intensite, -.35, .1)
        if t0 + 2.5 * temps < fin:
            m.poser(doum(.6), humain(t0 + 2.5 * temps), .7 * intensite, 0, .1)
        if basse_on:
            n = NOTES[BASSES[k % 4]]
            m.poser(basse(n, temps * 1.6, .9), t0, .55 * intensite, 0, .05)
            if t0 + 2.5 * temps < fin:
                m.poser(basse(n, temps * .9, .7), t0 + 2.5 * temps, .45 * intensite, 0, .05)
        if oud_on:
            for pas, note, d in OUD[k % 2]:
                tt = t0 + pas * temps / 2
                if tt < fin:
                    m.poser(oud(note, .45 * d, .75), humain(tt), .8 * intensite, .25, .3)
        t0 += 4 * temps
        k += 1


def transition(m, t, force=1.0, sens=1):
    m.souffle(t - .3, .45, 350, 5500, sens, .45 * force, rev=.2)
    m.poser(impact(.7 * force), t, .7 * force, 0, .45)


def final(m, t0, temps=.5):
    """Écran final commun : souffle, impact sur le L, scintillement, groove puis accord tenu."""
    m.souffle(t0, .55, 300, 6000, -1, .5, rev=.25)
    m.poser(montee(.6, .5), t0, 1, 0, .3)
    m.poser(impact(1.0), t0 + .6, 1.0, 0, .55)
    m.scintillement(t0 + .6, ['D6', 'F6', 'G6', 'A6', 'C7', 'D7'], .035, 1.0)
    groove(m, t0 + .6, DUREE - 1.4, temps, .85)
    t = DUREE - 1.4
    m.poser(doum(1), t, 1.1, 0, .4); m.poser(bendir(), t, .9, 0, .4); m.poser(clap(1), t, .6, 0, .5)
    m.poser(basse(NOTES['D2'], 1.3, 1), t, .7, 0, .1)
    for i, n in enumerate(['D3', 'A3', 'D4', 'F4', 'A4', 'D5']):
        m.poser(oud(n, 1.3, .8), t + i * .018, 1, -.3 + i * .12, .5)
    m.scintillement(t, ['D6', 'F6', 'A6', 'D7'], .06, .8)


def equipe(m):
    # Ouverture
    m.nappe(0, 1.6, ['D3', 'A3', 'D4', 'F4'], .2)
    m.scintillement(.55, ['D6', 'F6', 'A6'], .06, .6)
    m.poser(montee(.9, .55), .6, 1, 0, .25)
    # Coupes toutes les 0,9 s (groove à 133 BPM : deux temps par coupe)
    T = [1.5, 2.4, 3.3, 4.2, 5.1]
    for i, t in enumerate(T):
        transition(m, t, .8 if i else 1.0, 1 if i % 2 else -1)
        m.poser(cloche(NOTES[['D5', 'F5', 'G5', 'A5', 'C5'][i]] * 2, 1.0, .5), t + .15, 1, (i - 2) * .3, .5)
    groove(m, 1.5, 6.0, .45, .95)
    # Collage et coches
    transition(m, 6.0, .9, -1)
    for i in range(5):
        m.poser(cloche(NOTES[['D6', 'F6', 'G6', 'A6', 'D7'][i]], .9, .6), 6.97 + i * .1, 1, (i - 2) * .35, .45)
    m.souffle(7.3, .5, 300, 5000, 1, .45, rev=.2)
    # Téléphone : groove à 120 BPM
    groove(m, 7.55, 11.4, .5, .85)
    for t in (9.05, 9.5, 10.2, 10.6):
        m.poser(declic(1), t, .7, 0, .05)
        m.notification(t + .5, .55)
    m.souffle(9.55, .5, 600, 4500, 1, .25)
    m.souffle(10.8, .45, 500, 4000, -1, .25)
    m.poser(declic(1), 11.28, .8, 0, .05)
    m.tiroir_caisse(11.3, .8)
    m.poser(montee(.4, .5), 11.25, 1, 0, .25)
    m.poser(impact(.8), 11.62, .75, 0, .5)
    final(m, 11.65)


def budget(m):
    # Le chaos des devis : tension
    m.nappe(0, 2.4, ['D3', 'Eb4', 'A3', 'F4'], .22)
    for k in range(10):
        m.souffle(k * .22, .3, 900, 3500, 1 if k % 2 else -1, .12)
    for t in (0, .5, 1.0, 1.5):
        m.poser(doum(1), t, .9, 0, .15)
        m.poser(tek(.8), t + .25, .4, .2, .15)
    m.poser(impact(.5, bois=True), 1.0, .5, 0, .3)
    m.poser(impact(.6, bois=True), 1.5, .55, 0, .3)
    m.poser(montee(.5, .6), 1.85, 1, 0, .25)
    m.souffle(1.95, .5, 300, 7000, 1, .6, rev=.2)
    # Les prix sont affichés
    m.poser(impact(.9), 2.38, .9, 0, .5)
    m.scintillement(2.38, ['D6', 'F6', 'A6', 'D7'], .04, .9)
    for i, n in enumerate(['D5', 'F5', 'G5', 'A5', 'C5']):
        m.poser(cloche(NOTES[n] * 2, .8, .6), 2.85 + i * .12, 1, (i - 2) * .3, .4)
    groove(m, 2.5, 3.7, .5, .7, oud_on=False)
    # Le ticket
    transition(m, 3.75, .8, -1)
    groove(m, 4.0, 10.5, .5, .85)
    for i in range(5):
        t = 4.6 + i * .62
        m.souffle(t - .1, .25, 800, 4000, 1, .15)
        for k in range(6):
            m.poser(declic(.7), t + .1 + k * .06, .45, alea.uniform(-.2, .2), .05)
        m.poser(cloche(NOTES[['D6', 'F6', 'G6', 'A6', 'C7'][i]], .9, .7), t + .12, 1, .3, .4)
    m.tiroir_caisse(7.65, 1.0)
    m.notification(7.8, .7)
    m.poser(impact(1.0, bois=True), 8.53, 1.0, 0, .35)
    m.souffle(9.1, .4, 500, 4000, 1, .3)
    m.souffle(10.5, .55, 300, 6000, -1, .5, rev=.2)
    m.poser(montee(.5, .5), 10.6, 1, 0, .25)
    m.poser(impact(.8), 11.1, .75, 0, .5)
    final(m, 11.15)


def confiance(m):
    m.nappe(0, 2.1, ['D3', 'A3', 'D4', 'F4'], .2)
    for i, n in enumerate(['A4', 'C5', 'D5', 'F5', 'A5']):
        m.poser(oud(n, .5, .7), .2 + i * .25, 1, .2, .45)
    m.poser(montee(.5, .55), 1.5, 1, 0, .25)
    transition(m, 2.0, 1.0)
    groove(m, 2.0, 10.4, .5, .85)
    # Pilier 1 : la coche
    m.scintillement(2.95, ['D6', 'A6', 'D7'], .05, .7)
    m.poser(cloche(NOTES['D6'], 1.0, .8), 3.0, 1, 0, .4)
    # Pilier 2 : le cadenas se ferme
    transition(m, 4.05, .7, -1)
    m.poser(declic(1.2), 5.0, 1, .2, .1); m.poser(declic(1), 5.06, .8, .2, .1)
    m.poser(impact(.5, bois=True), 5.15, .5, 0, .3)
    m.scintillement(5.15, ['F6', 'A6', 'C7'], .05, .6)
    # Pilier 3 : la frise
    transition(m, 6.15, .7, 1)
    for i, n in enumerate(['D6', 'F6', 'A6']):
        m.poser(cloche(NOTES[n], 1.0, .8), 6.4 + i * .42, 1, (i - 1) * .5, .45)
    m.tiroir_caisse(7.26, 1.0)
    # Pilier 4 : les étoiles
    m.souffle(8.0, .45, 300, 5000, -1, .4, rev=.2)
    for i, n in enumerate(['D6', 'F6', 'G6', 'A6', 'D7']):
        m.poser(cloche(NOTES[n], .9, .75), 8.85 + i * .12, 1, (i - 2) * .35, .45)
    m.notification(9.55, .7)
    # Récapitulatif
    transition(m, 10.4, .7, -1)
    groove(m, 10.4, 11.4, .5, .7, oud_on=False)
    for i, n in enumerate(['A5', 'D6', 'F6', 'A6']):
        m.poser(cloche(NOTES[n], .8, .6), 10.7 + i * .12, 1, (i - 1.5) * .3, .4)
    m.poser(montee(.4, .5), 11.25, 1, 0, .25)
    m.poser(impact(.8), 11.62, .75, 0, .5)
    final(m, 11.65)


if __name__ == '__main__':
    nom, sortie = sys.argv[1], sys.argv[2]
    m = Mixage(DUREE)
    {'equipe': equipe, 'budget': budget, 'confiance': confiance}[nom](m)
    m.ecrire(sortie)
    print('Bande-son écrite :', sortie)
