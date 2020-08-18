class VolumeViewer {
  constructor(
    mainViewerDimensions,
    legendDimensions,
    sideDoseProfileDimensions,
    id
  ) {
    // Set dimensions
    this.mainViewerDimensions = mainViewerDimensions;
    this.legendDimensions = legendDimensions;
    this.sideDoseProfileDimensions = sideDoseProfileDimensions;

    // Intialize class properties
    this.doseVolume = null;
    this.densityVolume = null;
    this.panels = null;
    this.sliceSliders = {};
    this.doseProfileList = null;
    this.dispatch = d3.dispatch("markerchange");

    this.buildBaseHtml(id);
    this.intializeDispatch();
  }

  setDoseVolume(doseVol) {
    let sliceNum = 0;
    this.doseVolume = doseVol;

    // Set dose volume html elements
    doseVol.setHtmlObjects(
      this.svgObjs["plot-dose"],
      this.doseLegendHolder,
      this.doseLegendSvg
    );

    doseVol.initializeMaxDoseSlider();
    doseVol.initializeLegend();
    doseVol.initializeDoseContourInput();
    // TODO: Figure out a better layout for event listeners
    axes.forEach((axis) => {
      let slice = doseVol.getSlice(axis, sliceNum);
      doseVol.drawDose(slice);
      // Update the axis
      drawAxes(this.svgObjs["axis-svg"][axis], slice);
    });

    // Set the panel doseVolume object
    Object.values(this.panels).forEach((panel) => {
      panel.doseVol = doseVol;
      if (!panel.volume) {
        panel.volume = doseVol;
        // Update the slider max values
        let dims = "zxy";
        axes.forEach((axis, i) =>
          this.sliceSliders[axis].setMaxValue(doseVol.data.voxelNumber[dims[i]])
        );
      }
    });

    enableCoordInputs(doseVol.data.voxelNumber);
    enableCheckboxForDoseProfilePlot();
    enableExportVisualizationButton();
    enableCheckboxForVoxelInformation();
  }

  setDensityVolume(densityVol) {
    let sliceNum = 0;
    this.densityVolume = densityVol;

    densityVol.setHtmlObjects(
      this.svgObjs["plot-density"],
      this.densityLegendHolder,
      this.densityLegendSvg
    );

    densityVol.initializeLegend();
    axes.forEach((axis) => {
      let slice = densityVol.getSlice(axis, sliceNum);
      densityVol.drawDensity(slice);
      // Update the axis
      drawAxes(this.svgObjs["axis-svg"][axis], slice);
    });

    // Set the panel densityVolume object
    Object.values(this.panels).forEach((panel) => {
      panel.densityVol = densityVol;
      if (!panel.volume) {
        panel.volume = densityVol;
        // Update the slider max values
        let dims = "zxy";
        axes.forEach((axis, i) =>
          this.sliceSliders[axis].setMaxValue(
            densityVol.data.voxelNumber[dims[i]]
          )
        );
      }
    });

    if (this.doseVolume) {
      enableCheckboxForDensityPlot();
    }
    enableExportVisualizationButton();
    initializeWindowAndLevelSlider(densityVol);
    enableCheckboxForVoxelInformation();
  }

  updateMaxSliderValues() {
    // Update the slider max values
    let volume = this.densityVolume || this.doseVolume;
    let dims = "zxy";
    axes.forEach((axis, i) =>
      sliceSliders[axis].setMaxValue(volume.data.voxelNumber[dims[i]])
    );
  }

  getMarginStr(margin) {
    return (
      margin.top +
      "px " +
      margin.right +
      "px " +
      margin.bottom +
      "px " +
      margin.left +
      "px"
    );
  }

  updateDoseFileSelector(doseVol, i) {
    this.doseSelector.append("option").attr("value", i).text(doseVol.fileName);
  }

  updateDensityFileSelector(densityVol, i) {
    this.densitySelector
      .append("option")
      .attr("value", i)
      .text(densityVol.fileName);
  }

  setUpFileSelectors() {
    let volumeViewer = this;

    this.doseSelector.on("change", function () {
      volumeViewer.setDoseVolume(doseVolumeList[this.value]);
    });

    this.densitySelector.on("change", function () {
      volumeViewer.setDensityVolume(densityVolumeList[this.value]);
    });
  }

  buildBaseHtml(id) {
    // Select main div
    let base = d3.select("#image-to-print");

    // Add the file selector dropdowns
    let fileSelector = base.append("div").attr("class", "file-selector");
    this.densitySelector = fileSelector
      .append("select")
      .attr("name", "density-file");
    this.densitySelector
      .append("option")
      .attr("value", "")
      .text("Choose a density file");
    this.doseSelector = fileSelector.append("select").attr("name", "dose-file");
    this.doseSelector
      .append("option")
      .attr("value", "")
      .text("Choose a dose file");

    // Set up the file selector dropdowns
    this.setUpFileSelectors();

    // Add div to hold the panels, legend, and dose profiles
    let volHolder = base
      .append("div")
      .attr("id", "volume-holder-" + id)
      .attr("class", "volume-holder");

    // Append div to hold the panels
    this.viewerContainer = volHolder
      .append("span")
      .attr("class", "container")
      .style("vertical-align", "top");

    // Append div to hold the legend
    this.legendHolder = volHolder.append("span").attr("class", "legend-holder");

    // Append div to hold the dose profiles
    this.doseProfileHolder = volHolder
      .append("span")
      .attr("class", "dose-profile-holder");

    // Build other html and class objects
    this.buildViewerContainer(this.mainViewerDimensions);
    this.buildLegend(this.legendDimensions);
    this.buildDoseProfile(this.sideDoseProfileDimensions);
    this.buildPanels(mainViewerDimensions);
  }

  buildViewerContainer(mainViewerDimensions) {
    // TODO: In panel class, have build html instead
    // For each axis and plot class, make html
    let classes = ["axis-svg", "plot-density", "plot-dose", "plot-marker"];
    let type = ["svg", "canvas", "svg", "svg"];
    this.svgObjs = {
      "axis-svg": {},
      "plot-density": {},
      "plot-dose": {},
      "plot-marker": {},
    };

    this.axisObjs = {
      xy: {},
      yz: {},
      xz: {},
    };

    // Add html for panels and slice sliders
    axes.forEach((axis) => {
      let selectedDiv = this.viewerContainer
        .append("div")
        .classed("panel-" + axis, true)
        .style("display", "inline-block");

      // Slice slider callback and parameters
      var onSliceChangeCallback = (sliderVal) => {
        let currPanel = this.panels[axis];
        // Update slice of current panel
        currPanel.updateSlice(parseInt(sliderVal));

        // Update marker position, voxel information and dose profile
        let plotCoords = currPanel.markerPosition;
        if (plotCoords) {
          dispatch.call("markerchange", this, {
            plotCoords: plotCoords,
            panel: currPanel,
          });
        }
      };

      let sliceSliderParams = {
        id: "slice-number-" + axis,
        label: "Slice Number",
        format: d3.format("d"),
        startingVal: 0,
        minVal: 0,
        maxVal: 1,
        step: 1,
      };

      // Build new slider
      this.sliceSliders[axis] = new Slider(
        selectedDiv,
        onSliceChangeCallback,
        sliceSliderParams
      );

      // Build div to hold the panel
      let imageHolder = selectedDiv
        .append("div")
        .classed("imageholder-" + axis, true)
        .classed("parent", true);

      classes.forEach((className, i) => {
        let layerNum = i + 1;
        let plot = imageHolder
          .append("div")
          .classed("layer-" + layerNum, true)
          .style("z-index", layerNum)
          .append(type[i])
          .classed(className, true)
          .classed(axis, true)
          .classed("plot", true)
          .attr("width", mainViewerDimensions.width)
          .attr("height", mainViewerDimensions.height)
          .style("margin", this.getMarginStr(mainViewerDimensions.margin));

        this.svgObjs[className][axis] = plot;
        this.axisObjs[axis][className] = plot;
      });
    });
  }

  buildLegend(legendDimensions) {
    // Set up legends
    var getLegendHolderAndSvg = (className) => {
      let legendHolder = this.legendHolder
        .append("span")
        .attr("id", className + "-legend-holder")
        .style("width", legendDimensions.width + "px")
        .style("height", legendDimensions.height + "px")
        .style("margin", this.getMarginStr(legendDimensions.margin));

      let legendSvg = legendHolder
        .append("svg")
        .attr("id", className + "-legend-svg")
        .attr("class", "legend");

      return [legendHolder, legendSvg];
    };

    [this.doseLegendHolder, this.doseLegendSvg] = getLegendHolderAndSvg("dose");
    [this.densityLegendHolder, this.densityLegendSvg] = getLegendHolderAndSvg(
      "density"
    );
  }

  buildDoseProfile(sideDoseProfileDimensions) {
    // Initializing svgs for dose profile plots
    this.doseProfileList = ["x", "y", "z"].map((dimension) => {
      let profileSvg = this.doseProfileHolder
        .append("svg")
        .attr("width", sideDoseProfileDimensions.fullWidth)
        .attr("height", sideDoseProfileDimensions.fullHeight)
        .append("g")
        .style(
          "transform",
          "translate(" +
            sideDoseProfileDimensions.margin.left +
            "px" +
            "," +
            sideDoseProfileDimensions.margin.top +
            "px" +
            ")"
        )
        .classed("dose-profile-plot", true)
        .classed(dimension, true);

      // Create box to capture mouse events
      profileSvg
        .append("rect")
        .attr("width", sideDoseProfileDimensions.width)
        .attr("height", sideDoseProfileDimensions.height)
        .attr("fill", "white")
        .attr("class", "bounding-box");

      // Create clip path to bound output after zooming
      profileSvg
        .append("defs")
        .append("clipPath")
        .attr("class", "clip-" + dimension)
        .attr("id", "clip-" + dimension + "-vol-1")
        .append("rect")
        .attr("width", sideDoseProfileDimensions.width)
        .attr("height", sideDoseProfileDimensions.height);

      let doseProfileAxis = new DoseProfile(
        sideDoseProfileDimensions,
        profileSvg
      );

      //TODO: Disable zoom until data is uploaded
      // Zooming for dose profile
      doseProfileAxis.zoomObj = getZoom(
        sideDoseProfileDimensions.width,
        sideDoseProfileDimensions.height,
        zoomedDoseProfile,
        [doseProfileAxis]
      );

      // Enable zooming
      doseProfileAxis.svg
        .select("rect.bounding-box")
        .call(doseProfileAxis.zoomObj);

      return doseProfileAxis;
    });
  }

  buildPanels(mainViewerDimensions) {
    this.panels = axes.reduce((obj, axis, i) => {
      return {
        ...obj,
        [axis]: new Panel(
          mainViewerDimensions,
          this.densityVol,
          this.doseVol,
          axis,
          this.axisObjs[axis],
          this.sliceSliders[axis],
          this.dispatch
        ),
      };
    }, {});
  }

  intializeDispatch() {
    // Set up marker coord change event
    let panels = this.panels;

    this.dispatch.on("markerchange.panels", function (d) {
      d.panel.updateSliceNum();
      d.panel.updateMarker(d.plotCoords);

      // Want to get the voxel coords then change the sliceNum of the other volume panels
      let voxelCoords = coordsToVoxel(
        d.plotCoords,
        d.panel.axis,
        d.panel.sliceNum,
        d.panel.volume,
        d.panel.zoomTransform,
        true
      );

      Object.values(panels).forEach((panel) => {
        if (panel.axis !== d.panel.axis) {
          let sliceNum, voxelNums;
          if (panel.axis === "xy") {
            sliceNum = voxelCoords[2];
            voxelNums = [voxelCoords[0], voxelCoords[1]];
          } else if (panel.axis === "yz") {
            sliceNum = voxelCoords[0];
            voxelNums = [voxelCoords[1], voxelCoords[2]];
          } else {
            sliceNum = voxelCoords[1];
            voxelNums = [voxelCoords[0], voxelCoords[2]];
          }

          // Convert voxel number to pixel value for both x and y coordinates
          let xScale, yScale;
          if (panel.zoomTransform) {
            xScale = panel.zoomTransform.rescaleX(
              panel.volume.prevSlice[panel.axis].contourXScale
            );
            yScale = panel.zoomTransform.rescaleY(
              panel.volume.prevSlice[panel.axis].contourYScale
            );
          } else {
            xScale = panel.volume.prevSlice[panel.axis].contourXScale;
            yScale = panel.volume.prevSlice[panel.axis].contourYScale;
          }

          let coords = [
            Math.ceil(xScale(voxelNums[0])),
            Math.ceil(yScale(voxelNums[1])),
          ];

          panel.updateMarker(coords, false);
          panel.updateSlice(sliceNum);
          panel.updateSlider(sliceNum);
        }
      });
    });

    this.dispatch.on("markerchange.voxelinfo", function (d) {
      updateVoxelCoords(
        d.panel.densityVol,
        d.panel.doseVol,
        d.plotCoords,
        d.panel.axis,
        d.panel.sliceNum,
        d.panel.zoomTransform,
        true
      );
    });
  }
}