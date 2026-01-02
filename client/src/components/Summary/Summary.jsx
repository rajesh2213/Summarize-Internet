import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import TypewriterText from '../TypewriterText/TypewriterText';
import styles from './Summary.module.css';
import logger from '../../utils/logger';

const Summary = ({ summary }) => {
    const [isTypingComplete, setIsTypingComplete] = useState(false);
    const [summaryContent, setSummaryContent] = useState('');

    useEffect(() => {
        logger.info('[Summary] Received summary data:', summary);
        logger.info('[Summary] Summary type:', typeof summary);
        
        if (typeof summary === 'string') {
            setSummaryContent(summary);
            return;
        }

        if (typeof summary !== 'object' || !summary) {
            setSummaryContent('No summary content available.');
            return;
        }

        let content = '';
        
        if (summary.tldr) {
            content += `📋 TL;DR\n${summary.tldr}\n\n`;
        }

        if (summary.bullets && Array.isArray(summary.bullets) && summary.bullets.length > 0) {
            content += `🔑 Key Points\n`;
            summary.bullets.forEach(bullet => {
                content += `• ${bullet}\n`;
            });
            content += '\n';
        }

        if (summary.key_sections && Array.isArray(summary.key_sections) && summary.key_sections.length > 0) {
            content += `📖 Key Sections\n`;
            summary.key_sections.forEach(section => {
                if (typeof section === 'string') {
                    content += `• ${section}\n`;
                } else if (section.heading && section.summary) {
                    content += `• ${section.heading}: ${section.summary}\n`;
                }
            });
            content += '\n';
        }

        if (summary.content_type) {
            const typeSpecificContent = getTypeSpecificContent(summary);
            if (typeSpecificContent) {
                content += `📈 Analysis Details\n${typeSpecificContent}\n\n`;
            }
        }

        setSummaryContent(content.trim());
        setIsTypingComplete(false);
    }, [summary]);

    const getTypeSpecificContent = (summary) => {
        const { content_type } = summary;
        
        switch (content_type) {
            case 'reddit':
                return [
                    summary.topic && `Topic: ${summary.topic}`,
                    summary.sentiment && `Sentiment: ${summary.sentiment}`,
                    summary.notable_comments && `Notable Comments: ${Array.isArray(summary.notable_comments) ? summary.notable_comments.join(', ') : summary.notable_comments}`
                ].filter(Boolean).join('\n');
                
            case 'youtube':
                let formattedTimestamps = '';
                if (summary.key_timestamps) {
                    logger.info('[Summary] key_timestamps type:', typeof summary.key_timestamps, 'value:', summary.key_timestamps);
                    if (Array.isArray(summary.key_timestamps)) {
                        formattedTimestamps = summary.key_timestamps.map(ts => {
                            if (typeof ts === 'string') {
                                return ts;
                            }
                            if (!ts) {
                                return '';
                            }
                            if (typeof ts === 'object') {
                                if (ts.timestamp || ts.time) {
                                    const timeValue = ts.timestamp || ts.time;
                                    const description = ts.event || ts.description || ts.title || ts.text || '';
                                    return `${timeValue}${description ? ` - ${description}` : ''}`;
                                }
                                const keys = Object.keys(ts);
                                if (keys.length > 0) {
                                    const timestamp = keys[0];
                                    const description = ts[timestamp];
                                    if (typeof description === 'string') {
                                        return `${timestamp} - ${description}`;
                                    } else if (typeof description === 'object' && description !== null) {
                                        const descText = description.text || description.description || description.event || JSON.stringify(description);
                                        return `${timestamp} - ${descText}`;
                                    }
                                    return `${timestamp} - ${String(description)}`;
                                }
                                const objKeys = Object.keys(ts);
                                if (objKeys.length > 0) {
                                    return objKeys.map(key => {
                                        const value = ts[key];
                                        if (typeof value === 'object' && value !== null) {
                                            return `${key}: ${JSON.stringify(value)}`;
                                        }
                                        return `${key}: ${value}`;
                                    }).join(', ');
                                }
                                return JSON.stringify(ts);
                            }
                            return String(ts);
                        }).filter(ts => ts && ts.trim() !== '').join('\n');
                    } else if (typeof summary.key_timestamps === 'object') {
                        const keys = Object.keys(summary.key_timestamps);
                        formattedTimestamps = keys.map(key => {
                            const value = summary.key_timestamps[key];
                            if (typeof value === 'string') {
                                return `${key} - ${value}`;
                            } else if (typeof value === 'object' && value !== null) {
                                return `${key} - ${JSON.stringify(value)}`;
                            }
                            return `${key} - ${String(value)}`;
                        }).join('\n');
                    } else {
                        formattedTimestamps = String(summary.key_timestamps);
                    }
                }
                
                return [
                    summary.topic && `Topic: ${summary.topic}`,
                    summary.duration_estimate && `Duration: ${summary.duration_estimate}`,
                    formattedTimestamps && typeof formattedTimestamps === 'string' && formattedTimestamps.trim() && `Key Timestamps:\n${formattedTimestamps}`
                ].filter(Boolean).join('\n');
                
            case 'shopping':
                return [
                    summary.product_name && `Product: ${summary.product_name}`,
                    summary.price_range && `Price Range: ${summary.price_range}`,
                    summary.key_features && `Features: ${summary.key_features}`,
                    summary.ratings && `Ratings: ${summary.ratings}`
                ].filter(Boolean).join('\n');
                
            case 'twitch':
                return [
                    summary.topic && `Topic: ${summary.topic}`,
                    summary.streamer && `Streamer: ${summary.streamer}`,
                    summary.chat_highlights && `Chat Highlights: ${summary.chat_highlights}`
                ].filter(Boolean).join('\n');
                
            case 'webpage':
                return [
                    summary.page_type && `Page Type: ${summary.page_type}`,
                    summary.topic && `Topic: ${summary.topic}`,
                    summary.author && `Author: ${summary.author}`,
                    summary.publication_date && `Published: ${summary.publication_date}`
                ].filter(Boolean).join('\n');
                
            case 'data_dump':
                return [
                    summary.format && `Format: ${summary.format}`,
                    summary.notable_fields && `Notable Fields: ${Array.isArray(summary.notable_fields) ? summary.notable_fields.join(', ') : summary.notable_fields}`,
                    summary.patterns && `Patterns: ${summary.patterns}`
                ].filter(Boolean).join('\n');
                
            default:
                return null;
        }
    };

    return (
        <div className={styles.professionalSummary}>
            <div className={styles.summaryHeader}>
                <div className={styles.contentTypeBadge}>
                    {summary?.content_type?.toUpperCase() || 'SUMMARY'}
                </div>
            </div>
            
            <div className={styles.summaryBody}>
                <TypewriterText 
                    text={summaryContent} 
                    speed={20}
                    onComplete={() => setIsTypingComplete(true)}
                />
            </div>
        </div>
    );
};

Summary.propTypes = {
    summary: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.object
    ]).isRequired
};

export default Summary;