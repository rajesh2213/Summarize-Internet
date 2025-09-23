export const statusMap = {
  QUEUED:        { stage: "Preparing", step: 1, progress: 10 },
  FETCHING_HTML: { stage: "Preparing", step: 1, progress: 20 },
  CLEANING:      { stage: "Analyzing", step: 2, progress: 40 },
  INGESTING:     { stage: "Analyzing", step: 2, progress: 55 },
  SUMMARIZING:   { stage: "Summarizing", step: 3, progress: 80 },
  FINALIZING:    { stage: "Finishing", step: 4, progress: 95 },
  COMPLETED:     { stage: "Done", step: 5, progress: 100 },
  ERROR:         { stage: "Something went wrong", step: 5, progress: 100 }
};
