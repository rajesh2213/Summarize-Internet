import PropTypes from "prop-types"
import styles from './LoadingBar.module.css'
import { statusMap } from "../../utils/statusMap"
import logger from '../../utils/logger'

const LoadingBar = ({ id, status = "QUEUED" }) => {
    const { stage, step, progress } = statusMap[status] || statusMap["QUEUED"]

    const allSteps = [...new Set(Object.values(statusMap).map(s => s.step))].filter(s => s !== 5).sort((a, b) => a - b);

    const progressPerStep = 100 / allSteps.length;
    const completedProgress = (step - 1) * progressPerStep;
    const currentSegmentProgress = progress - completedProgress;

    logger.info(`[LoadingBar] State updated - docId: ${id}, step: ${step}, progress: ${progress}, stage: ${stage}`)

    const stageLabels = {
        1: "Preparing",
        2: "Analyzing",
        3: "Generating",
        4: "Summarizing"
    }

    return (
        <div className={styles.progressContainer}>
            <div className={styles.progressBarOuter}>
                <div className={styles.progressBar}>
                    <div
                        className={styles.completedFill}
                        style={{ width: `${completedProgress}%` }}
                    ></div>

                    <div
                        className={styles.currentFill}
                        style={{
                            width: `${currentSegmentProgress}%`,
                            left: `${completedProgress}%`
                        }}
                    ></div>

                    {allSteps.map((stageStep, index) => {
                        const separatorPosition = ((index + 1) / allSteps.length) * 100;

                        if (index === allSteps.length - 1) return null;

                        return (
                            <div
                                key={`separator-${stageStep}`}
                                className={styles.arrowSeparator}
                                style={{ left: `${separatorPosition}%` }}
                            ></div>
                        );
                    })}
                </div>

                <div className={styles.stageLabels}>
                    {allSteps.map((stageStep) => (
                        <div key={`label-${stageStep}`} className={styles.stageLabelItem}>
                            {stageLabels[stageStep]}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

LoadingBar.propTypes = {
    id: PropTypes.string.isRequired,
    status: PropTypes.string
}
LoadingBar.defaultProps = {
    status: 'QUEUED'
}

export default LoadingBar;
