#!/bin/bash
# Supervisor Service Management Script

SERVICE_DIR="/home/samuel/.archon/workspaces/supervisor-service"
LOG_FILE="/tmp/supervisor-service.log"
PID_FILE="/tmp/supervisor-service.pid"

cd "$SERVICE_DIR" || exit 1

case "$1" in
  start)
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
      echo "❌ Service is already running (PID: $(cat $PID_FILE))"
      exit 1
    fi

    echo "🚀 Starting Supervisor Service..."
    nohup npm start > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 3

    if kill -0 $(cat "$PID_FILE") 2>/dev/null; then
      echo "✅ Service started successfully!"
      echo "PID: $(cat $PID_FILE)"
      echo "Logs: tail -f $LOG_FILE"
      curl -s http://localhost:8081/health | jq . 2>/dev/null || curl -s http://localhost:8081/health
    else
      echo "❌ Failed to start service"
      tail -20 "$LOG_FILE"
      rm -f "$PID_FILE"
      exit 1
    fi
    ;;

  stop)
    if [ ! -f "$PID_FILE" ]; then
      echo "❌ No PID file found"
      # Try to find and kill anyway
      pkill -f "node dist/index.js" && echo "✅ Killed running processes"
      exit 0
    fi

    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      echo "🛑 Stopping service (PID: $PID)..."
      kill "$PID"
      sleep 2

      if kill -0 "$PID" 2>/dev/null; then
        echo "⚠️  Forcing shutdown..."
        kill -9 "$PID"
      fi

      rm -f "$PID_FILE"
      echo "✅ Service stopped"
    else
      echo "❌ Service not running"
      rm -f "$PID_FILE"
    fi
    ;;

  restart)
    echo "🔄 Restarting service..."
    $0 stop
    sleep 2
    $0 start
    ;;

  status)
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
      echo "✅ Service is running"
      echo "PID: $(cat $PID_FILE)"
      echo ""
      curl -s http://localhost:8081/health | jq . 2>/dev/null || curl -s http://localhost:8081/health
    else
      echo "❌ Service is not running"
      [ -f "$PID_FILE" ] && rm -f "$PID_FILE"
      exit 1
    fi
    ;;

  logs)
    tail -f "$LOG_FILE"
    ;;

  mcp)
    echo "🔌 Starting MCP Server..."
    echo "Press Ctrl+C to stop"
    npm run mcp
    ;;

  *)
    echo "Supervisor Service Management"
    echo ""
    echo "Usage: $0 {start|stop|restart|status|logs|mcp}"
    echo ""
    echo "Commands:"
    echo "  start    - Start the service"
    echo "  stop     - Stop the service"
    echo "  restart  - Restart the service"
    echo "  status   - Check service status"
    echo "  logs     - View service logs"
    echo "  mcp      - Start MCP server for Claude.ai Projects"
    echo ""
    echo "Examples:"
    echo "  ./service.sh start"
    echo "  ./service.sh status"
    echo "  ./service.sh logs"
    exit 1
    ;;
esac
