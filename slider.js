function updateSliderAfterAxisChange(slice) {
  let sliderRange = d3.select("#slider-range").node();
  let sliceNum = getSliceNum();

  // Enable slider if disabled
  if (sliderRange.disabled) sliderRange.disabled = false;

  // Change max slider value to max number of slices
  if (sliceNum >= slice.totalSlices) {
    d3.select("#slider-value").node().value = slice.totalSlices - 1;
  }
  sliderRange.max = slice.totalSlices - 1;
  d3.select("#slider-max").node().value = slice.totalSlices - 1;
}

function updateImage(axis, sliceNum) {
  // Update image if densityVol data and/or doseVol data exists
  let slice;
  let context;
  if (!densityVol.isEmpty()) {
    slice = densityVol.getSlice(axis, sliceNum);
    context = densityVol.getSliceImageContext(slice, svgAxis, svgDensity);
  }
  if (!doseVol.isEmpty()) {
    slice = doseVol.getSlice(axis, sliceNum);
    context = doseVol.getSliceImageContext(slice, svgDose);
  }

  //Update voxel coordinates
  plotCoords && updateVoxelCoords(plotCoords, axis, sliceNum);
}

d3.select("#increment-slider").on("click", function () {
  slider = d3.select("#slider-range").node();
  slider.stepUp(1);

  // Update slider text
  d3.select("#slider-value").node().value = slider.value;

  updateImage(axis, slider.value);
});

d3.select("#decrement-slider").on("click", function () {
  slider = d3.select("#slider-range").node();
  slider.stepDown(1);

  // Update slider text
  d3.select("#slider-value").node().value = slider.value;

  updateImage(axis, slider.value);
});

d3.select("#slider-range").on("input", function () {
  // Update slider text
  d3.select("#slider-value").node().value = this.value;
  sliceNum = parseInt(this.value);

  updateImage(axis, sliceNum);

  return true;
});

// TODO: Fix marker position on axis change!!!
d3.selectAll("input[name='axis']").on("change", function () {
  axis = this.value;
  let sliceNum = getSliceNum();
  // Update image if densityVol data and/or doseVol data exists
  let slice;
  let context;
  if (!densityVol.isEmpty()) {
    slice = densityVol.getSlice(axis, sliceNum);
    context = densityVol.getSliceImageContext(slice, svgAxis, svgDensity);
  }
  if (!doseVol.isEmpty()) {
    slice = doseVol.getSlice(axis, sliceNum);
    context = doseVol.getSliceImageContext(slice, svgDose);
  }

  if (!densityVol.isEmpty() || !doseVol.isEmpty()) {
    updateSliderAfterAxisChange(slice);
  }

  //Update voxel coordinates
  plotCoords && updateVoxelCoords(plotCoords, axis, sliceNum, true);

  return true;
});