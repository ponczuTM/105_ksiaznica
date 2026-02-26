import subprocess
import sys
import os


def replace_audio_and_trim(video_path, audio_path, output_path):
    # Sprawdzenie czy pliki istnieją
    if not os.path.isfile(video_path):
        print(f"Nie znaleziono pliku wideo: {video_path}")
        sys.exit(1)

    if not os.path.isfile(audio_path):
        print(f"Nie znaleziono pliku audio: {audio_path}")
        sys.exit(1)

    # Komenda ffmpeg:
    # -i video.mp4      -> wejściowe wideo
    # -i b1.mp3         -> wejściowe audio
    # -map 0:v:0        -> bierzemy tylko wideo z pierwszego pliku
    # -map 1:a:0        -> bierzemy audio z drugiego pliku
    # -c:v copy         -> kopiujemy wideo bez rekompresji (szybko)
    # -c:a aac          -> konwersja mp3 -> aac (mp4 wymaga aac)
    # -shortest         -> utnij do długości krótszego strumienia (czyli mp3)
    # -y                -> nadpisz plik bez pytania

    command = [
        "ffmpeg",
        "-i", video_path,
        "-i", audio_path,
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", "aac",
        "-shortest",
        "-y",
        output_path
    ]

    try:
        subprocess.run(command, check=True)
        print(f"Gotowe. Zapisano jako: {output_path}")
    except subprocess.CalledProcessError as e:
        print("Błąd podczas przetwarzania:", e)
        sys.exit(1)


if __name__ == "__main__":
    video_file = "v3.mp4"
    audio_file = "t1.mp3"
    output_file = "test.mp4"

    replace_audio_and_trim(video_file, audio_file, output_file)