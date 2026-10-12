#include <jni.h>
#include <string>
#include <cstdlib>
#include <cstring>
#include <unistd.h>
#include <pthread.h>
#include <android/log.h>

#define TAG "NodeServerRunnerNative"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

namespace node {
    extern int Start(int argc, char *argv[]);
}

static int pfd[2];
static pthread_t thr;
static bool is_redirecting = false;

static void *stdout_stderr_thread(void *) {
    ssize_t rdsz;
    char buf[2048];
    while ((rdsz = read(pfd[0], buf, sizeof(buf) - 1)) > 0) {
        if (buf[rdsz - 1] == '\n') --rdsz;
        buf[rdsz] = 0;
        LOGI("[NodeJS] %s", buf);
    }
    return nullptr;
}

static int start_redirecting_stdout_stderr() {
    if (is_redirecting) return 0;
    is_redirecting = true;

    setvbuf(stdout, nullptr, _IOLBF, 0);
    setvbuf(stderr, nullptr, _IONBF, 0);
    if (pipe(pfd) != 0) {
        LOGE("Gagal membuat pipe stdout/stderr");
        return -1;
    }
    dup2(pfd[1], 1);
    dup2(pfd[1], 2);
    if (pthread_create(&thr, nullptr, stdout_stderr_thread, nullptr) != 0) {
        LOGE("Gagal membuat thread stdout/stderr");
        return -1;
    }
    pthread_detach(thr);
    return 0;
}

extern "C" JNIEXPORT void JNICALL
Java_com_wabot_assistant_NodeServerRunner_setEnvironmentVariable(
        JNIEnv *env,
        jobject /* this */,
        jstring key,
        jstring value) {
    if (!key || !value) return;
    const char *k = env->GetStringUTFChars(key, nullptr);
    const char *v = env->GetStringUTFChars(value, nullptr);
    if (k && v) {
        LOGI("Setenv: %s = %s", k, v);
        setenv(k, v, 1);
    }
    if (k) env->ReleaseStringUTFChars(key, k);
    if (v) env->ReleaseStringUTFChars(value, v);
}

extern "C" JNIEXPORT jint JNICALL
Java_com_wabot_assistant_NodeServerRunner_startNodeWithArguments(
        JNIEnv *env,
        jobject /* this */,
        jobjectArray arguments) {

    start_redirecting_stdout_stderr();

    jsize argument_count = env->GetArrayLength(arguments);
    LOGI("Starting embedded Node.js with %d arguments...", argument_count);

    int c_arguments_size = 0;
    for (int i = 0; i < argument_count; i++) {
        jstring str = (jstring) env->GetObjectArrayElement(arguments, i);
        if (!str) continue;
        const char *chars = env->GetStringUTFChars(str, nullptr);
        if (chars) {
            c_arguments_size += strlen(chars) + 1;
            env->ReleaseStringUTFChars(str, chars);
        }
    }

    char *args_buffer = (char *) calloc(c_arguments_size > 0 ? c_arguments_size : 1, sizeof(char));
    char *argv[argument_count];
    char *current_args_position = args_buffer;

    for (int i = 0; i < argument_count; i++) {
        jstring str = (jstring) env->GetObjectArrayElement(arguments, i);
        if (!str) {
            argv[i] = (char *) "";
            continue;
        }
        const char *chars = env->GetStringUTFChars(str, nullptr);
        if (chars) {
            strncpy(current_args_position, chars, strlen(chars));
            argv[i] = current_args_position;
            current_args_position += strlen(current_args_position) + 1;
            LOGI("  argv[%d] = %s", i, argv[i]);
            env->ReleaseStringUTFChars(str, chars);
        } else {
            argv[i] = (char *) "";
        }
    }

    LOGI("Calling node::Start(argc, argv)...");
    int exit_code = node::Start(argument_count, argv);
    LOGI("node::Start has terminated with exit code %d", exit_code);

    free(args_buffer);
    return jint(exit_code);
}
