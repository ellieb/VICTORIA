---
title: 'VICTORIA, the Voxel Interactive Contour Tool for Online Radiation Intensity Analytics'
tags:
  - JavaScript
  - medical physics
  - medical imaging
  - web-based software
  - DICOM viewer
authors:
  - name: Elise Badun
    orcid: 0000-0001-7256-855X
    corresponding: true
    affiliation: 1
  - name: Fr\'ed\'eric Tessier
    corresponding: false
    affiliation: 2
  - name: Reid Townson
    corresponding: false
    affiliation: 2
  - name: Ernesto Mainegra-Hing
    corresponding: false
    affiliation: 2
  - name: Margaret-Anne Storey
    corresponding: false
    affiliation: 1
  - name: Magdalena Bazalova-Carter
    corresponding: false
    affiliation: 1
affiliations:
 - name: University of Victoria, Canada
   index: 1
 - name: National Research Council, Canada
   index: 2
date: 1 October 2022
bibliography: paper.bib
---

# Summary

Computed tomography (CT) is an imaging procedure used visualize the inside of the body, and is commonly used by radiologists to identify tumors. When creating a radiation treatment plan, radiotherapy dose distributions are generated to visualize the dose alongside the CT images. The CT and dose files often hold large amounts of data, requiring specific software to visualize them. Many popular software tools exist to visualize these images, but are commonly expensive and require downloads. The goal of VICTORIA is to be an easy tool to view and compare different dose and density files in a standard web browser, requiring no additional software download and installation. VICTORIA was initially developed as a web tool that could easily view and compare phantom and dose files from the EGSnrc toolkit, an Electron Gamma Shower software package by the National Research Council of Canada (NRC). The EGSnrc Monte Carlo (MC) toolkit is a well-known medical physics package that simulates the transport of ionizing radiation through matter [@egsnrc_2021]. It can model the transport of electrons, positrons, and photons with energies ranging from 1 keV to 10 GeV, in user-defined geometries. The EGSnrc package uses custom file types .egsphant and .3ddose, which are formatted plain text files containing phantom and dose information. 

# Statement of need

VICTORIA is a tool for the visualization and comparison of dose distributions with underlying anatomy that is web-accessible, free, designed with security in mind, and available on the web. The viewer should be useful for researchers using EGSnrc file types .egsphant and .3ddose from the EGSnrc toolkit, patients who want a simple tool to view files, or researchers using DICOM Computed Tomography (CT) and DICOM Radiotherapy (RT) Dose files in low- or middle-income countries without access to treatment planning systems. The viewer can be accessed at [the XCITE lab website](http://web.uvic.ca/~bazalova/VICTORIA/)

# Methods

Most of the data visualization capabilities come from D3, a JavaScript library made for producing dynamic data-based displays by binding input to the Document Object Model (DOM) and applying transformations [@bostock_2020]. D3 provides many user interface functions in VICTORIA, particularly data plotting, axes support, click events, zooming, and other changes to the DOM. The dicomParser library from Cornerstone is used to read in and parse DICOM files [@dicomparser_2020]. The other libraries in use are d3-legend, which creates colour-based legends, as well as filesaver and dom-to-image, which assists in saving the volume viewer to PNG [@d3legend_2019; @filesaver_2020; @domtoimage_2017].

# Figures

![A volume viewer with a CT Image file and RT Dose file loaded and displayed. The window and level of the density file has been adjusted. The dose profile along the red cross-hairs has been plotted. The ROI contours are shown and the corresponding DVH is plotted beneath the dose profiles. The dose has been normalized to 4500 cGy at 90%, and this is reflected in the DVH x-axis. A few ROI contours have been toggled off.](VICTORIA-example.pdf)

# Acknowledgments
The authors would like to thank the University of Victoria for the Science Undergraduate Research Award, NSERC Discovery Grant and the Canada Research Chair program that partially supported the work.

# References

