import { useState, useRef, useCallback, useEffect } from 'react';
import styles from './ResizableSplitter.module.css';

const ResizableSplitter = ({ 
  children, 
  initialSize = 50, 
  minSize = 20, 
  maxSize = 80,
  direction = 'horizontal',
  className = ''
}) => {
  const [leftSize, setLeftSize] = useState(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const splitterRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const isHorizontal = direction === 'horizontal';
    const clientPos = isHorizontal ? e.clientX : e.clientY;
    const containerPos = isHorizontal ? containerRect.left : containerRect.top;
    const containerSize = isHorizontal ? containerRect.width : containerRect.height;
    
    const percentage = ((clientPos - containerPos) / containerSize) * 100;
    const clampedPercentage = Math.max(minSize, Math.min(maxSize, percentage));
    
    setLeftSize(clampedPercentage);
  }, [isDragging, direction, minSize, maxSize]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const rightSize = 100 - leftSize;

  return (
    <div 
      ref={containerRef}
      className={`${styles.container} ${styles[direction]} ${className}`}
    >
      <div 
        className={styles.panel}
        style={{ 
          [direction === 'horizontal' ? 'width' : 'height']: `${leftSize}%` 
        }}
      >
        {children[0]}
      </div>
      
      <div
        ref={splitterRef}
        className={`${styles.splitter} ${styles[direction]}`}
        onMouseDown={handleMouseDown}
      >
        <div className={styles.splitterHandle}>
          <div className={styles.splitterGrip}></div>
          <div className={styles.splitterGrip}></div>
          <div className={styles.splitterGrip}></div>
        </div>
      </div>
      
      <div 
        className={styles.panel}
        style={{ 
          [direction === 'horizontal' ? 'width' : 'height']: `${rightSize}%` 
        }}
      >
        {children[1]}
      </div>
    </div>
  );
};

export default ResizableSplitter;
