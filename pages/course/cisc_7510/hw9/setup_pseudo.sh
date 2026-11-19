#!/usr/bin/env bash
# Start or stop a 1-node (pseudo-distributed) Hadoop cluster: HDFS plus YARN on localhost.
# Daemons are started directly, so no ssh server is needed.
# Usage: ./setup_pseudo.sh start|stop|status
# Config and data live under ./conf-pseudo and ~/.hadoop-flying, not in the Homebrew install.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
HADOOP_HOME="${HADOOP_HOME:-$(brew --prefix hadoop)/libexec}"
export HADOOP_HOME
export JAVA_HOME="${JAVA_HOME:-$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home}"
export HADOOP_CONF_DIR="$here/conf-pseudo"
data="$HOME/.hadoop-flying"

write_conf() {
  # Java classpath wildcards only expand one directory level, so list each jar directory.
  CP=""
  for m in common hdfs mapreduce yarn; do CP="$CP$HADOOP_HOME/share/hadoop/$m/*:$HADOOP_HOME/share/hadoop/$m/lib/*:"; done
  CP="${CP%:}"
  mkdir -p "$HADOOP_CONF_DIR" "$data"
  cp -n "$HADOOP_HOME"/etc/hadoop/log4j.properties "$HADOOP_HOME"/etc/hadoop/capacity-scheduler.xml "$HADOOP_CONF_DIR"/ 2>/dev/null || true
  cat > "$HADOOP_CONF_DIR/hadoop-env.sh" <<EOF
export JAVA_HOME=$JAVA_HOME
export HADOOP_LOG_DIR=$data/logs
EOF
  cat > "$HADOOP_CONF_DIR/core-site.xml" <<EOF
<configuration>
  <property><name>fs.defaultFS</name><value>hdfs://localhost:9000</value></property>
  <property><name>hadoop.tmp.dir</name><value>$data/tmp</value></property>
</configuration>
EOF
  cat > "$HADOOP_CONF_DIR/hdfs-site.xml" <<EOF
<configuration>
  <property><name>dfs.replication</name><value>1</value></property>
  <property><name>dfs.namenode.name.dir</name><value>file://$data/name</value></property>
  <property><name>dfs.datanode.data.dir</name><value>file://$data/data</value></property>
</configuration>
EOF
  cat > "$HADOOP_CONF_DIR/mapred-site.xml" <<EOF
<configuration>
  <property><name>mapreduce.framework.name</name><value>yarn</value></property>
  <property><name>mapreduce.application.classpath</name><value>$CP</value></property>
  <property><name>yarn.app.mapreduce.am.env</name><value>HADOOP_MAPRED_HOME=$HADOOP_HOME</value></property>
  <property><name>mapreduce.map.env</name><value>HADOOP_MAPRED_HOME=$HADOOP_HOME</value></property>
  <property><name>mapreduce.reduce.env</name><value>HADOOP_MAPRED_HOME=$HADOOP_HOME</value></property>
</configuration>
EOF
  cat > "$HADOOP_CONF_DIR/yarn-site.xml" <<EOF
<configuration>
  <property><name>yarn.application.classpath</name><value>$CP</value></property>
  <property><name>yarn.nodemanager.aux-services</name><value>mapreduce_shuffle</value></property>
  <property><name>yarn.nodemanager.env-whitelist</name><value>JAVA_HOME,HADOOP_COMMON_HOME,HADOOP_HDFS_HOME,HADOOP_CONF_DIR,HADOOP_MAPRED_HOME,PATH</value></property>
  <property><name>yarn.nodemanager.resource.memory-mb</name><value>6144</value></property>
  <property><name>yarn.scheduler.maximum-allocation-mb</name><value>6144</value></property>
  <property><name>yarn.nodemanager.vmem-check-enabled</name><value>false</value></property>
</configuration>
EOF
}

case "${1:-}" in
  start)
    write_conf
    [ -d "$data/name/current" ] || "$HADOOP_HOME/bin/hdfs" namenode -format -force -nonInteractive
    "$HADOOP_HOME/bin/hdfs" --daemon start namenode
    "$HADOOP_HOME/bin/hdfs" --daemon start datanode
    "$HADOOP_HOME/bin/yarn" --daemon start resourcemanager
    "$HADOOP_HOME/bin/yarn" --daemon start nodemanager
    for _ in $(seq 30); do "$HADOOP_HOME/bin/hdfs" dfsadmin -safemode get 2>/dev/null | grep -q OFF && break; sleep 2; done
    "$HADOOP_HOME/bin/hdfs" dfs -mkdir -p "/user/$USER"
    echo "cluster up: HDFS http://localhost:9870  YARN http://localhost:8088"
    ;;
  stop)
    export HADOOP_CONF_DIR
    for d in nodemanager resourcemanager; do "$HADOOP_HOME/bin/yarn" --daemon stop $d || true; done
    for d in datanode namenode; do "$HADOOP_HOME/bin/hdfs" --daemon stop $d || true; done
    ;;
  status)
    "$JAVA_HOME/bin/jps"
    ;;
  *) echo "usage: $0 start|stop|status" >&2; exit 2 ;;
esac
