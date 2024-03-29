# VICTORIA

The web app can be used on the XCITE lab website: http://web.uvic.ca/~bazalova/VICTORIA/

VICTORIA is a web-based visualization tool for DICOM, EGSnrc phantom, and EGSnrc dose
files. To use, either upload .3ddose, .egsphant, or DICOM files; or use the test files
available. If two or more dose files are uploaded, they can be compared in the
viewer. Dose contours can be added with the input box in the dose legend.
Contours can be toggled on and off by clicking the corresponding colour block in
the legend. Voxel information can be viewed by selecting the checkbox to show
voxel data and selecting a point in any of the three plots. Dose profiles can be
viewed by selecting the checkbox to plot dose profiles and choosing a point on
the plot to investigate.

## Installation

To run this webpage locally:

1.  Clone the repo
2.  Using the command line, `cd` into the VICTORIA folder
3.  If you have Python 3, start a local server using the command

         python -m http.server

    If you have Python 2, use the command

         python -m SimpleHTTPServer

4.  If the command is successful, it should give you a link (e.g.
    http://0.0.0.0:8000/) which you can paste into your browser to view the web page
    
    
## Issues

If you run into any issues, please feel free to submit an issue on Github, or even make a pull request with the fix. Note that [standard JavaScript](https://standardjs.com/rules.html) rules are currently used for formatting


## Functionality
A short paper about VICTORIA can be found on [arXiv](https://arxiv.org/abs/2105.14145).

### Accepted File Types

The viewer accepts file types of .egsphant, .3ddose, DICOM CT Image, DICOM RT Dose, and DICOM RT Structure Set. The files can be loaded with drag and drop, or by opening a file manager to navigate through the user directory. Alternatively, there are test files loaded on the site that consist of a .egsphant density file, an RT Dose file, and a structure set file of a patient, for users to test out the website.

### User Interface

The website is divided into panes called volume viewers, where each volume viewer can display a density file (either .egsphant or CT Image), a dose file (.3ddose, RT Dose, or a dose difference), and region of interest (ROI) contours in three panels for the sagittal, coronal, and axial views. The density and dose can be selected using drop down menus at the top of each volume viewer, and the ROI contours are matched by the study unique identifier (UID) or position.

### Navigation

Each panel can traverse through a view of the volume by moving though its slices. Since the navigation of the slices is based on position rather than voxel number, files that have incompatible voxel dimensions but the same position can still be viewed together. To increase the speed of navigating through a volume, density caching with Web Workers was implemented.

### Data Display

VICTORIA supports the ability to view the difference between two uploaded dose files. This can allow users to compare two different patient plans generated by either a commercial treatment planning system (TPS) or by MC codes (i.e. EGSnrc or TOPAS), to compare doses calculated by a MC code against a commercial TPS, to compare dose distributions calculated by two difference MC codes, or to compare MC dose distributions calculated with different transport parameters. The dose difference is calculated by dividing each dose matrix by its maximum dose value, then subtracting the second dose matrix from the first, using tri-linear interpolation if the voxel dimensions are different. The panels are navigable by using sliders to move through slice by slice, or by clicking on a point to update the other two panels to the same location. The panels also support panning and zooming.

The density files are displayed as an image, whereas the dose files are displayed as isodose contours. The dose contours are calculated using the D3 contours function, which returns an array of polygons where the input values are greater than the given thresholds, without any smoothing or interpolation. The default dose contours are from 10% to 100% in 10% increments. An input box at the bottom of the dose contour legend gives the user the option to input custom dose contours that are not already displayed (e.g., 5%). A toggle function is also available to show/hide individual dose contours by clicking the corresponding legend cell. The option to plot the dose profiles is also available when a dose file is loaded. The dose profiles contain the dose data along the cross-hairs where the user clicks in the z, x, and y dimensions.

Similar functionality to the dose contours is available for the ROI contours. The structure sets are matched to the volume by the existing density and dose files, rather than the user selecting which structure set to display. They are matched if they have the same study instance UID or if the extent of the density/dose overlap with the ROI contours. The user can toggle on and off which ROI contours are visible in the volume viewer. If there is a dose file loaded, there is also an option to plot a dose volume histogram (DVH). This will go through each ROI contour in the structure set, determine the dose enclosed by each, and calculate the cumulative dose delivered in each portion of the ROI. Again, toggling the ROI legend will toggle the data shown in the DVH plot.

There are various options the user can make with the check-boxes at the top of each volume viewer. The user can normalize the dose files from cGy to percent, or vice versa. This changes the scale for the DVH. The normalization from percent to cGy is mandatory if the user would like to plot a DVH while using a dose file with relative doses. The voxel information of the position of the panel click can also be displayed. This will show the voxel number, absolute position, density, dose, and material of the position where the user clicks. Another checkbox can plot the dose profile along the cross-hairs of where a user clicks if a dose volume is currently displayed in the viewer. If a set of ROI contours has been uploaded, a checkbox will be available to show or hide them. If ROI contours and dose data are plotted, an option to plot a DVH is also available.
The sliders on the upper right of each volume viewer control different display options. The density sliders can be used to adjust the window and level of the density plots. The max dose slider adjusts the maximum dose for plotting purposes (i.e. if the max dose is 100 cGy, and the max dose slider is set to 80%, the plot will now be adjusted so the dose at 100% is 80 cGy, adjusting the dose contours levels). If a dose comparison is plotted, the dose comparison normalization slider will behave similarly, adjusting the normalization factor of the second dose volume that is being compared, from 0.5 to 1.5.

### Export Formats

Exporting dose profiles or DVH data to CSV allows for analysis in spreadsheet software. If the dose profiles are displayed, the data can be downloaded by selecting the ’Export dose profiles to CSV’ button. The positions and dose values of the three dose profiles are then downloaded as a CSV file. The ’Export DVH to CSV’ button works similarly, exporting the percent of the ROI volume with the dose value for each of the ROIs. To export the visualization as an image, the ’Export visualization to PNG’ button can be used to download a screenshot of the current viewer.


## Acknowledgements

This project is a collaboration between Elise Badun and Magdalena
Bazalova-Carter of the University of Victoria, and Frederic Tessier, Reid
Townson, and Ernesto Mainegra-Hing of the NRC.


