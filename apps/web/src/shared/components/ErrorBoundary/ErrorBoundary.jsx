import { Component } from 'react'
import styles from './ErrorBoundary.module.css'

// Contains a render crash to the section it wraps instead of unmounting the
// whole app. Surfaced by #226: a missing import in PlantInsightsSection threw
// on render, and with no boundary anywhere in the tree, the entire page went
// blank — including the back button. Wrap each independently-risky section of
// a page (a chart, a data-derived insights panel, anything doing its own
// modeling math) so one broken section degrades gracefully instead of taking
// the rest of the page down with it.
//
// Class component because React's error-boundary hooks (getDerivedStateFromError,
// componentDidCatch) only exist on classes — there's no hook equivalent yet.
export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // No error-reporting service wired up (no backend) — console is the
    // only place this is visible, same as an uncaught error would be.
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`, error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <p className={styles.fallback}>
          🤕 {this.props.label ? `${this.props.label} ` : 'This section '}
          couldn't load. The rest of the page should still work.
        </p>
      )
    }
    return this.props.children
  }
}
