const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serwowanie plików statycznych
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rozszerzona lista haseł
const wordPairs = [
  { word: "KOT", hint: "Zwierzę domowe" },
  { word: "SAMOCHÓD", hint: "Środek transportu" },
  { word: "KSIĄŻKA", hint: "Źródło wiedzy" },
  { word: "TELEFON", hint: "Urządzenie do komunikacji" },
  { word: "OKNO", hint: "Element budynku" },
  { word: "DRZEWO", hint: "Roślina" },
  { word: "SŁOŃCE", hint: "Gwiazda" },
  { word: "WODA", hint: "Płyn" },
  { word: "OGIEŃ", hint: "Żywioł" },
  { word: "ZAMEK", hint: "Budowla" },
  { word: "PIES", hint: "Przyjaciel człowieka" },
  { word: "MIASTO", hint: "Duża osada" },
  { word: "RZEKA", hint: "Płynąca woda" },
  { word: "GÓRY", hint: "Wysokie tereny" },
  { word: "MORZE", hint: "Duża woda" },
  { word: "LAS", hint: "Wiele drzew" },
  { word: "SZKŁO", hint: "Przezroczysty materiał" },
  { word: "PAPIER", hint: "Do pisania" },
  { word: "STÓŁ", hint: "Meble" },
  { word: "KRZESŁO", hint: "Do siedzenia" },
  { word: "OGRODNIK", hint: "Zawód" },
  { word: "KWIAT", hint: "Roślina ozdobna" },
  { word: "SAMOLOT", hint: "Środek transportu powietrznego" },
  { word: "ROWER", hint: "Pojazd dwukołowy" },
  { word: "KOMPUTER", hint: "Urządzenie elektroniczne" },
  { word: "LAMPKA", hint: "Źródło światła" },
  { word: "KALENDARZ", hint: "System pomiaru czasu" },
  { word: "TELEWIZOR", hint: "Urządzenie do oglądania programów" },
  { word: "FOTEL", hint: "Mebel do siedzenia" },
  { word: "PARASOL", hint: "Ochrona przed deszczem" },
  { word: "ZEGAR", hint: "Pokazuje czas" },
  { word: "KAPELUSZ", hint: "Nakrycie głowy" },
  { word: "BUTY", hint: "Obuwie" },
  { word: "PLECAK", hint: "Torba na plecach" },
  { word: "OKULARY", hint: "Do patrzenia" },
  { word: "DŁUGOPIS", hint: "Narzędzie do pisania" },
  { word: "NOTATNIK", hint: "Zeszyt" },
  { word: "LUSTRO", hint: "Odbija obraz" },
  { word: "WISZĄCY", hint: "Zawieszenie" },
  { word: "ŚWIATŁO", hint: "Oświetlenie" },
  { word: "GITARA", hint: "Instrument muzyczny" },
  { word: "PIANINO", hint: "Duży instrument" },
  { word: "KAMERA", hint: "Nagrywa obrazy" },
  { word: "DYWAN", hint: "Wykładzina podłogowa" },
  { word: "KOC", hint: "Do przykrycia" },
  { word: "PODUSZKA", hint: "Do spania" },
  { word: "ŁÓŻKO", hint: "Mebel do spania" },
  { word: "SZAFKA", hint: "Mebel na rzeczy" },
  { word: "LODÓWKA", hint: "Chłodzi jedzenie" },
  { word: "PIEKARNIK", hint: "Pieczenie" },
  { word: "ZLEW", hint: "Mycie naczyń" },
  { word: "SZTUĆCE", hint: "Przyrządy do jedzenia" },
  { word: "TALERZ", hint: "Naczynie na jedzenie" },
  { word: "KUBEK", hint: "Do picia" },
  { word: "CZAPKA", hint: "Nakrycie głowy" },
  { word: "SZALIK", hint: "Owijanie szyi" },
  { word: "RĘKAWICZKI", hint: "Na dłonie" },
  { word: "KURTKA", hint: "Odzież wierzchnia" },
  { word: "SPODNIE", hint: "Odzież na nogi" },
  { word: "KOSZULA", hint: "Odzież górna" },
  { word: "SKARPETKI", hint: "Na stopy" },
  { word: "SZNURÓWKI", hint: "Do wiązania" },
  { word: "SUKIENKA", hint: "Odzież damska" },
  { word: "KRAWAT", hint: "Męski dodatek" },
  { word: "BIŻUTERIA", hint: "Ozdoby" },
  { word: "PIERŚCIEŃ", hint: "Na palec" },
  { word: "NASZYJNIK", hint: "Na szyję" },
  { word: "BRANSOLETKA", hint: "Na nadgarstek" },
  { word: "KOLCZYKI", hint: "W uszach" },
  { word: "PORTRET", hint: "Obraz osoby" },
  { word: "OBRAZ", hint: "Malowidło" },
  { word: "RZEŹBA", hint: "Sztuka 3D" },
  { word: "KWIATY", hint: "Rośliny ozdobne" },
  { word: "DONICZKA", hint: "Na rośliny" },
  { word: "WĄŻ", hint: "Gad" },
  { word: "PTAK", hint: "Lata" },
  { word: "RYBA", hint: "Pływa" },
  { word: "MOTYL", hint: "Skrzydlate owady" },
  { word: "PSZCZOŁA", hint: "Daje miód" },
  { word: "MRÓWKA", hint: "Małe owady" },
  { word: "ŻABA", hint: "Skacze" },
  { word: "JEŻ", hint: "Kolczasty" },
  { word: "ZAJĄC", hint: "Szybki" },
  { word: "SARNĄ", hint: "Leśne zwierzę" },
  { word: "WILK", hint: "Drapieżnik" },
  { word: "NIEDŹWIEDŹ", hint: "Duże zwierzę" },
  { word: "LIS", hint: "Rudy" },
  { word: "WIEŻA", hint: "Wysoka budowla" },
  { word: "MOST", hint: "Przejście przez wodę" },
  { word: "TUNEL", hint: "Pod ziemią" },
  { word: "DROGA", hint: "Do jazdy" },
  { word: "ŚCIEŻKA", hint: "Wąska droga" },
  { word: "PARK", hint: "Miejsce relaksu" },
  { word: "PLAC", hint: "Otwarta przestrzeń" },
  { word: "POMNIK", hint: "Upamiętnienie" },
  { word: "FONTANNA", hint: "Woda tryska" },
  { word: "ŁAWKA", hint: "Do siedzenia" },
  { word: "LATARNIA", hint: "Oświetla" },
  { word: "KOSZ", hint: "Na śmieci" },
  { word: "SKRZYŻOWANIE", hint: "Przecinanie dróg" },
  { word: "SZYNA", hint: "Dla pociągu" },
  { word: "PERON", hint: "Czekanie na pociąg" },
  { word: "DWORZEC", hint: "Stacja kolejowa" },
  { word: "LOTNISKO", hint: "Samoloty" },
  { word: "PORT", hint: "Statki" },
  { word: "PLAŻA", hint: "Nad morzem" },
  { word: "PIASEK", hint: "Na plaży" },
  { word: "MUSZLA", hint: "Z morza" },
  { word: "FALA", hint: "Na wodzie" },
  { word: "ŁÓDKA", hint: "Mały statek" },
  { word: "JACHT", hint: "Luksusowa łódź" },
  { word: "ŻAGIEL", hint: "Napęd łodzi" },
  { word: "KOTWICA", hint: "Utrzymuje statek" },
  { word: "KOMUNIKAT", hint: "Wiadomość" },
  { word: "LIST", hint: "Wiadomość pisemna" },
  { word: "KOPERTA", hint: "Na list" },
  { word: "ZNAK", hint: "Oznaczenie" },
  { word: "TABLICA", hint: "Do pisania" },
  { word: "KREDA", hint: "Do tablicy" },
  { word: "GUMKA", hint: "Do ścierania" },
  { word: "LINIJKA", hint: "Do mierzenia" },
  { word: "CYRYKL", hint: "Do kół" },
  { word: "NOŻYCE", hint: "Do cięcia" },
  { word: "KLEJ", hint: "Łączy" },
  { word: "ZESZYT", hint: "Do pisania" },
  { word: "KSIĄŻKA", hint: "Do czytania" },
  { word: "BIBLIOTEKA", hint: "Miejsce z książkami" },
  { word: "CZYTELNIA", hint: "Czytanie książek" },
  { word: "REGAL", hint: "Na książki" },
  { word: "PÓŁKA", hint: "Miejsce na rzeczy" },
  { word: "SZAFA", hint: "Duży mebel" },
  { word: "SZUFŁADA", hint: "W szafie" },
  { word: "WĄTEK", hint: "Nić" },
  { word: "IGŁA", hint: "Do szycia" },
  { word: "NITKA", hint: "Do zszywania" },
  { word: "GUZIK", hint: "Zapięcie" },
  { word: "ZAMEK", hint: "Błyskawiczny" },
  { word: "RZEP", hint: "Zapięcie" },
  { word: "KARTA", hint: "Do płatności" },
  { word: "PORTFEL", hint: "Na pieniądze" },
  { word: "MONETA", hint: "Pieniądz" },
  { word: "BANKNOT", hint: "Pieniądz papierowy" },
  { word: "SKARBONKA", hint: "Na oszczędności" },
  { word: "KALKULATOR", hint: "Liczy" },
  { word: "LICZNIK", hint: "Pokazuje liczbę" },
  { word: "WAGA", hint: "Mierzy ciężar" },
  { word: "TERMOMETR", hint: "Temperatura" },
  { word: "BAROMETR", hint: "Ciśnienie" },
  { word: "KOMPAS", hint: "Kierunek" },
  { word: "MAPĄ", hint: "Plan terenu" },
  { word: "GLOBUS", hint: "Model Ziemi" },
  { word: "ATLAS", hint: "Zbiór map" },
  { word: "PRZEWODNIK", hint: "Po miejscu" },
  { word: "BILET", hint: "Uprawnienie" },
  { word: "KASA", hint: "Sprzedaż biletów" },
  { word: "KONTROLA", hint: "Sprawdzanie" },
  { word: "STRAŻNIK", hint: "Pilnuje" },
  { word: "POLICJANT", hint: "Porządek" },
  { word: "STRAŻAK", hint: "Gaszenie" },
  { word: "LEKARZ", hint: "Leczy" },
  { word: "PIELĘGNIARKA", hint: "Pomaga lekarzowi" },
  { word: "FARMACEUTA", hint: "Leki" },
  { word: "NAUCZYCIEL", hint: "Uczy" },
  { word: "UCZEŃ", hint: "Uczy się" },
  { word: "STUDENT", hint: "Studiuje" },
  { word: "PROFESOR", hint: "Wykładowca" },
  { word: "DYREKTOR", hint: "Kieruje" },
  { word: "SEKRETARKA", hint: "Pomaga" },
  { word: "KELNER", hint: "Obsługuje" },
  { word: "KUCHARZ", hint: "Gotuje" },
  { word: "SPRZĄTACZKA", hint: "Sprząta" },
  { word: "TŁUMACZ", hint: "Przekłada" },
  { word: "PISARZ", hint: "Pisze książki" },
  { word: "POETA", hint: "Pisze wiersze" },
  { word: "ARTYSTA", hint: "Tworzy sztukę" },
  { word: "MALARZ", hint: "Maluje" },
  { word: "RZEŹBIARZ", hint: "Rzeźbi" },
  { word: "FOTOGRAF", hint: "Robi zdjęcia" },
  { word: "DZIENNIKARZ", hint: "Pisze newsy" },
  { word: "REPORTER", hint: "Relacjonuje" },
  { word: "KAMERZYSTA", hint: "Nagrywa" },
  { word: "REŻYSER", hint: "Kieruje filmem" },
  { word: "AKTOR", hint: "Gra rolę" },
  { word: "AKTORKA", hint: "Gra rolę" },
  { word: "PIOSENKARZ", hint: "Śpiewa" },
  { word: "MUZYK", hint: "Gra muzykę" },
  { word: "TANCERZ", hint: "Tańczy" },
  { word: "CHOREOGRAF", hint: "Układa taniec" },
  { word: "SPORTOWIEC", hint: "Uprawia sport" },
  { word: "TRENER", hint: "Trenuje" },
  { word: "SĘDZIA", hint: "Prowadzi mecz" },
  { word: "KIBIC", hint: "Kibicuje" },
  { word: "DZIENNIKARZ", hint: "Pisze o sporcie" },
  { word: "KOMENTATOR", hint: "Komentuje" },
  { word: "MISTRZ", hint: "Najlepszy" },
  { word: "WICEMISTRZ", hint: "Drugi" },
  { word: "BRĄZ", hint: "Trzeci" },
  { word: "MEDAL", hint: "Nagroda" },
  { word: "PUCHAR", hint: "Trofeum" },
  { word: "TROFEUM", hint: "Nagroda" },
  { word: "DIPLOM", hint: "Certyfikat" },
  { word: "CERTYFIKAT", hint: "Poświadczenie" },
  { word: "NAGRODA", hint: "Wyróżnienie" },
  { word: "WYRÓŻNIENIE", hint: "Uznanie" },
  { word: "LAUR", hint: "Zwycięstwo" },
  { word: "ZWYCIĘSTWO", hint: "Wygrać" },
  { word: "PORAŻKA", hint: "Przegrać" },
  { word: "REMIS", hint: "Nierozstrzygnięty" },
  { word: "WYNIK", hint: "Rezultat" },
  { word: "TABELA", hint: "Wyniki" },
  { word: "KLASYFIKACJA", hint: "Ranking" },
  { word: "RUNDA", hint: "Etap" },
  { word: "ETAP", hint: "Faza" },
  { word: "FAZA", hint: "Etap" },
  { word: "FINALS", hint: "Końcowy" },
  { word: "PÓŁFINAŁ", hint: "Przed finałem" },
  { word: "ĆWIERĆFINAŁ", hint: "Przed półfinałem" },
  { word: "GRUPA", hint: "Zespół" },
  { word: "DRUŻYNA", hint: "Zespół" },
  { word: "ZESPÓŁ", hint: "Grupa" },
  { word: "KAPITAN", hint: "Lider" },
  { word: "LIDER", hint: "Przewodnik" },
  { word: "PRZEWODNIK", hint: "Prowadzi" },
  { word: "NASTĘPCA", hint: "Po kimś" },
  { word: "NASTĘPNY", hint: "Kolejny" },
  { word: "POPRZEDNI", hint: "Wcześniejszy" },
  { word: "OBECNY", hint: "Teraz" },
  { word: "BYŁY", hint: "Wcześniejszy" },
  { word: "PRZYSZŁY", hint: "Następny" },
  { word: "PRZESZŁY", hint: "Miniony" },
  { word: "TERAŹNIEJSZY", hint: "Obecny" },
  { word: "PRZYSZŁY", hint: "Następny czas" },
  { word: "PRZYSZŁOŚĆ", hint: "Co będzie" },
  { word: "PRZESZŁOŚĆ", hint: "Co było" },
  { word: "TERAŹNIEJSZOŚĆ", hint: "Co jest" },
  { word: "CHWILA", hint: "Moment" },
  { word: "MOMENT", hint: "Chwila" },
  { word: "SEKUNDA", hint: "Czas" },
  { word: "MINUTA", hint: "60 sekund" },
  { word: "GODZINA", hint: "60 minut" },
  { word: "DZIEŃ", hint: "24 godziny" },
  { word: "TYDZIEŃ", hint: "7 dni" },
  { word: "MIESIĄC", hint: "~30 dni" },
  { word: "ROK", hint: "12 miesięcy" },
  { word: "DZIESIĘCIOLECIE", hint: "10 lat" },
  { word: "STULECIE", hint: "100 lat" },
  { word: "TYSIĄCLECIE", hint: "1000 lat" },
  { word: "EPOKA", hint: "Okres" },
  { word: "ERA", hint: "Epoka" },
  { word: "OKRES", hint: "Czas" },
  { word: "CZAS", hint: "Trwanie" },
  { word: "TRWANIE", hint: "Czas" },
  { word: "DŁUGOŚĆ", hint: "Rozmiar" },
  { word: "SZEROKOŚĆ", hint: "Szeroki" },
  { word: "WYSOKOŚĆ", hint: "Wysoki" },
  { word: "GŁĘBOKOŚĆ", hint: "Głęboki" },
  { word: "ROZMIAR", hint: "Wielkość" },
  { word: "WIELKOŚĆ", hint: "Rozmiar" },
  { word: "MAŁOŚĆ", hint: "Mały" },
  { word: "DUŻOŚĆ", hint: "Duży" },
  { word: "ŚREDNIOŚĆ", hint: "Średni" },
  { word: "OGROMNOŚĆ", hint: "Ogromny" },
  { word: "MINIATUROWOŚĆ", hint: "Miniaturowy" },
  { word: "OLBRZYMIE", hint: "Bardzo duże" },
  { word: "KARZEŁ", hint: "Bardzo małe" },
  { word: "OLBRZYM", hint: "Bardzo duże" },
  { word: "GIGANT", hint: "Ogromny" },
  { word: "KOLOS", hint: "Wielki" },
  { word: "TITAN", hint: "Gigantyczny" },
  { word: "MONSTER", hint: "Potwór" },
  { word: "POTWÓR", hint: "Straszny" },
  { word: "SMOK", hint: "Mityczne" },
  { word: "JEDNOROŻEC", hint: "Z rogiem" },
  { word: "FENIKS", hint: "Z ognia" },
  { word: "GRIFFIN", hint: "Pół orzeł" },
  { word: "CENTAUR", hint: "Pół człowiek" },
  { word: "SYRENA", hint: "Pół ryba" },
  { word: "WILKOŁAK", hint: "Pół wilk" },
  { word: "WAMPIR", hint: "Pije krew" },
  { word: "DUCH", hint: "Niewidzialny" },
  { word: "ZOMBIE", hint: "Nieumarły" },
  { word: "SZKIELET", hint: "Kościec" },
  { word: "CZCICIEL", hint: "Czciciel" },
  { word: "CZAROWNICA", hint: "Magia" },
  { word: "CZARODZIEJ", hint: "Mag" },
  { word: "MAG", hint: "Magia" },
  { word: "WIEDŹMIN", hint: "Zabija potwory" },
  { word: "RYCERZ", hint: "Walczy" },
  { word: "WOJOWNIK", hint: "Wojownik" },
  { word: "ŻOŁNIERZ", hint: "W armii" },
  { word: "GENERAŁ", hint: "Dowódca" },
  { word: "KAPITAN", hint: "Dowódca okrętu" },
  { word: "ADMIRAŁ", hint: "Dowódca floty" },
  { word: "MAJOR", hint: "Stopień" },
  { word: "KAPITAN", hint: "Stopień wojskowy" },
  { word: "PORUCZNIK", hint: "Stopień" },
  { word: "SIERŻANT", hint: "Stopień" },
  { word: "KAPRAL", hint: "Stopień" },
  { word: "SZEREGOWIEC", hint: "Najniższy stopień" },
  { word: "REKRUT", hint: "Nowy żołnierz" },
  { word: "WETERAN", hint: "Doświadczony" },
  { word: "WETERAN", hint: "Stary żołnierz" },
  { word: "BOHATER", hint: "Odważny" },
  { word: "MĘŻNY", hint: "Odważny" },
  { word: "ODWAŻNY", hint: "Nie boi się" },
  { word: "TCHÓRZLIWY", hint: "Boi się" },
  { word: "STRASZLIWY", hint: "Straszny" },
  { word: "PRZERAŻAJĄCY", hint: "Bardzo straszny" },
  { word: "UPIÓR", hint: "Duch" },
  { word: "STRASZYDEŁO", hint: "Przestraszyć" },
  { word: "KOSZMAR", hint: "Zły sen" },
  { word: "SNY", hint: "Podczas snu" },
  { word: "MARZENIA", hint: "Chcieć" },
  { word: "NOCNY", hint: "W nocy" },
  { word: "DZIENNY", hint: "W dzień" },
  { word: "PORANNY", hint: "Rano" },
  { word: "WIECZORNY", hint: "Wieczorem" },
  { word: "POPOŁUDNIOWY", hint: "Po południu" },
  { word: "POŁUDNIOWY", hint: "W południe" },
  { word: "PÓŁNOCNY", hint: "O północy" },
  { word: "ŚWIT", hint: "Poranek" },
  { word: "ZMIERZCH", hint: "Wieczór" },
  { word: "ZACHÓD", hint: "Słońce zachodzi" },
  { word: "WSCHÓD", hint: "Słońce wschodzi" },
  { word: "HORYZONT", hint: "Linia widoku" },
  { word: "NIEBO", hint: "Nad nami" },
  { word: "CHMURA", hint: "W niebie" },
  { word: "DESZCZ", hint: "Pada" },
  { word: "ŚNIEG", hint: "Zimą" },
  { word: "GRAD", hint: "Lód z nieba" },
  { word: "BURZA", hint: "Pioruny" },
  { word: "PIORUN", hint: "Błyskawica" },
  { word: "BŁYSKAWICA", hint: "Światło" },
  { word: "GRZMOT", hint: "Dźwięk" },
  { word: "WICHURA", hint: "Silny wiatr" },
  { word: "WIATR", hint: "Powieje" },
  { word: "POWIEJ", hint: "Ruch powietrza" },
  { word: "HURAGAN", hint: "Bardzo silny wiatr" },
  { word: "TSUNAMI", hint: "Fala" },
  { word: "TRZĘSIENIE", hint: "Ziemi" },
  { word: "WULKAN", hint: "Wybucha" },
  { word: "LAWA", hint: "Z wulkanu" },
  { word: "POPIÓŁ", hint: "Po spaleniu" },
  { word: "DYM", hint: "Z ognia" },
  { word: "ISKRA", hint: "Z ognia" },
  { word: "PŁOMIEŃ", hint: "Ogień" },
  { word: "ŻAR", hint: "Gorąco" },
  { word: "GORĄCO", hint: "Wysoka temperatura" },
  { word: "ZIMNO", hint: "Niska temperatura" },
  { word: "CIEPŁO", hint: "Średnia temperatura" },
  { word: "TEMPERATURA", hint: "Ciepło/zimno" },
  { word: "KLIMAT", hint: "Długotrwała pogoda" },
  { word: "POGODA", hint: "Stan atmosfery" },
  { word: "ATMOSFERA", hint: "Powietrze" },
  { word: "POWIETRZE", hint: "Oddychamy" },
  { word: "TLEN", hint: "W powietrzu" },
  { word: "AZOT", hint: "W powietrzu" },
  { word: "DWUTLENEK", hint: "Węgla" },
  { word: "PARA", hint: "Wodna" },
  { word: "WILGOĆ", hint: "Woda w powietrzu" },
  { word: "SUCHOŚĆ", hint: "Brak wody" },
  { word: "MOKROŚĆ", hint: "Jest woda" },
  { word: "WILGOTNOŚĆ", hint: "Woda w powietrzu" },
  { word: "ROSA", hint: "Rano" },
  { word: "SZRON", hint: "Zimą" },
  { word: "SZADŹ", hint: "Zimą" },
  { word: "LÓD", hint: "Zamrożona woda" },
  { word: "ŚNIEG", hint: "Zimą spada" },
  { word: "BAŁWAN", hint: "Ze śniegu" },
  { word: "SANKI", hint: "Zimą" },
  { word: "NARTY", hint: "Na stoku" },
  { word: "SNOWBOARD", hint: "Jedna deska" },
  { word: "ŁYŻWY", hint: "Na lodzie" },
  { word: "HOKEJ", hint: "Na lodzie" },
  { word: "PŁYWANIE", hint: "W wodzie" },
  { word: "BASEN", hint: "Do pływania" },
  { word: "KĄPIELISKO", hint: "Miejsce kąpieli" },
  { word: "PLAŻA", hint: "Nad morzem" },
  { word: "PIASEK", hint: "Na plaży" },
  { word: "MUSZLA", hint: "Z morza" },
  { word: "KAMIEŃ", hint: "Twardy" },
  { word: "GŁAZ", hint: "Duży kamień" },
  { word: "SKAŁA", hint: "Twarda formacja" },
  { word: "GÓRA", hint: "Wysoka" },
  { word: "WZGÓRZE", hint: "Niskie góry" },
  { word: "WZGÓRZE", hint: "Mała góra" },
  { word: "DOLINA", hint: "Pomiędzy górami" },
  { word: "KANION", hint: "Głęboka dolina" },
  { word: "WĄWÓZ", hint: "Wąska dolina" },
  { word: "JASKINIA", hint: "Pod ziemią" },
  { word: "GROTA", hint: "Jaskinia" },
  { word: "STALAKTYTY", hint: "Z sufitu" },
  { word: "STALAGMITY", hint: "Z podłogi" },
  { word: "SKARLENIE", hint: "Z jaskini" },
  { word: "PODZIEMIE", hint: "Pod ziemią" },
  { word: "ZIEMIA", hint: "Planeta" },
  { word: "GLEBA", hint: "Warstwa ziemi" },
  { word: "PIASEK", hint: "Drobne ziarna" },
  { word: "ŻWIR", hint: "Drobne kamienie" },
  { word: "KAMIENIE", hint: "Twarde" },
  { word: "GŁAZY", hint: "Duże kamienie" },
  { word: "SKAŁY", hint: "Twarde formacje" },
  { word: "GRUNT", hint: "Ziemia" },
  { word: "DARŃ", hint: "Trawa" },
  { word: "TRAWA", hint: "Roślina" },
  { word: "MUrawa", hint: "Przycięta trawa" },
  { word: "MEch", hint: "Miękki" },
  { word: "POROST", hint: "Na drzewie" },
  { word: "KORA", hint: "Drzewa" },
  { word: "LIŚĆ", hint: "Drzewa" },
  { word: "GAŁĄŹ", hint: "Drzewa" },
  { word: "KONAR", hint: "Duża gałąź" },
  { word: "PNIĄ", hint: "Główna część" },
  { word: "KORZEŃ", hint: "Pod ziemią" },
  { word: "NASIONO", hint: "Z drzewa" },
  { word: "SZCZEP", hint: "Młode drzewo" },
  { word: "SADZONKA", hint: "Młoda roślina" },
  { word: "ROŚLINA", hint: "Żywa" },
  { word: "KWIAT", hint: "Ozdoba" },
  { word: "PĄK", hint: "Zanim zakwitnie" },
  { word: "PŁATEK", hint: "Kwiatu" },
  { word: "PŁATKI", hint: "Kwiatu" },
  { word: "SŁUPK", hint: "Kwiatu" },
  { word: "PRĘCIK", hint: "Kwiatu" },
  { word: "PYŁEK", hint: "Z kwiatu" },
  { word: "NEKTAR", hint: "Z kwiatu" },
  { word: "MIÓD", hint: "Z nektaru" },
  { word: "WOSK", hint: "Z pszczół" },
  { word: "UL", hint: "Dla pszczół" },
  { word: "PSZCZOŁA", hint: "Daje miód" },
  { word: "TRUTEŃ", hint: "Samiec pszczoły" },
  { word: "KRÓLOWA", hint: "Matka pszczół" },
  { word: "ROBAK", hint: "Małe zwierzę" },
  { word: "OWAD", hint: "Małe zwierzę" },
  { word: "PAJĄK", hint: "Z siecią" },
  { word: "SIECI", hint: "Pająka" },
  { word: "PĘDZLAK", hint: "Mały pająk" },
  { word: "SKORPION", hint: "Z ogonem" },
  { word: "KARAKURT", hint: "Jadowity pająk" },
  { word: "TARANTULA", hint: "Duży pająk" },
  { word: "STONOGA", hint: "Wiele nóg" },
  { word: "WIJA", hint: "Stonoga" },
  { word: "ŚLIMAK", hint: "Pełzający" },
  { word: "MUSZLA", hint: "Ślimaka" },
  { word: "MAŁŻ", hint: "W muszli" },
  { word: "OSTRYGA", hint: "Jadalny małż" },
  { word: "KREWETKA", hint: "Skorupiak" },
  { word: "RAK", hint: "Skorupiak" },
  { word: "KARAB", hint: "Duży rak" },
  { word: "HOMAR", hint: "Duży skorupiak" },
  { word: "KAMARON", hint: "Skorupiak" },
  { word: "KAŁAMARZ", hint: "Głowonóg" },
  { word: "OŚMIORNICA", hint: "8 ramion" },
  { word: "MĄTWĄ", hint: "Głowonóg" },
  { word: "MEDUZA", hint: "Parzy" },
  { word: "KORAL", hint: "W morzu" },
  { word: "RAFA", hint: "Koralowa" },
  { word: "PERŁA", hint: "Z ostrygi" },
  { word: "PERŁOPŁAW", hint: "Daje perły" },
  { word: "SZCZĘŚLIWY", hint: "Radosny" },
  { word: "RADOSNY", hint: "Szczęśliwy" },
  { word: "ZADOWOLONY", hint: "Zadowolony" },
  { word: "USZCZĘŚLIWIONY", hint: "Bardzo szczęśliwy" },
  { word: "ECSTATYCZNY", hint: "W euforii" },
  { word: "EUFORYCZNY", hint: "W euforii" },
  { word: "EUFORIA", hint: "Ekstremalna radość" },
  { word: "RADOŚĆ", hint: "Pozytywne uczucie" },
  { word: "SZCZĘŚCIE", hint: "Radość" },
  { word: "ZACHWYT", hint: "Podziw" },
  { word: "PODZIW", hint: "Uznanie" },
  { word: "UZNANIE", hint: "Docenienie" },
  { word: "DOCENIENIE", hint: "Wartość" },
  { word: "WARTOŚĆ", hint: "Cenna" },
  { word: "CENNA", hint: "Droga" },
  { word: "DROGA", hint: "Kosztowna" },
  { word: "KOSZTOWNA", hint: "Droga" },
  { word: "TANIA", hint: "Niedroga" },
  { word: "NIEDROGA", hint: "Tania" },
  { word: "DARMOWA", hint: "Bezpłatna" },
  { word: "BEZPŁATNA", hint: "Darmowa" },
  { word: "PŁATNA", hint: "Trzeba zapłacić" },
  { word: "OPŁATA", hint: "Płatność" },
  { word: "PŁATNOŚĆ", hint: "Zapłata" },
  { word: "ZAPŁATA", hint: "Pieniądze" },
  { word: "PIENIĄDZE", hint: "Środki płatnicze" },
  { word: "GOTÓWKA", hint: "Pieniądze" },
  { word: "KARTA", hint: "Płatnicza" },
  { word: "CZEK", hint: "Płatniczy" },
  { word: "WEKSEL", hint: "Płatniczy" },
  { word: "BANKNOT", hint: "Pieniądze" },
  { word: "MONETA", hint: "Pieniądze" },
  { word: "GROSZ", hint: "1/100 złotego" },
  { word: "ZŁOTY", hint: "Pieniądze Polski" },
  { word: "EURO", hint: "Pieniądze UE" },
  { word: "DOLAR", hint: "Pieniądze USA" },
  { word: "FUNT", hint: "Pieniądze UK" },
  { word: "JEN", hint: "Pieniądze Japonii" },
  { word: "JUAN", hint: "Pieniądze Chin" },
  { word: "RUBEL", hint: "Pieniądze Rosji" },
  { word: "FRANK", hint: "Pieniądze Szwajcarii" },
  { word: "KORONA", hint: "Pieniądze Czech" },
  { word: "FORINT", hint: "Pieniądze Węgier" },
  { word: "LEJ", hint: "Pieniądze Rumunii" },
  { word: "LEW", hint: "Pieniądze Bułgarii" },
  { word: "KUNA", hint: "Pieniądze Chorwacji" },
  { word: "DINAR", hint: "Pieniądze Serbii" },
  { word: "LIRA", hint: "Pieniądze Turcji" },
  { word: "SHEKEL", hint: "Pieniądze Izraela" },
  { word: "RUPIA", hint: "Pieniądze Indii" },
  { word: "BAHT", hint: "Pieniądze Tajlandii" },
  { word: "RINGGIT", hint: "Pieniądze Malezji" },
  { word: "DONG", hint: "Pieniądze Wietnamu" },
  { word: "WON", hint: "Pieniądze Korei" },
  { word: "PESO", hint: "Pieniądze Meksyku" },
  { word: "REAL", hint: "Pieniądze Brazylii" },
  { word: "PESO", hint: "Pieniądze Argentyny" },
  { word: "SOL", hint: "Pieniądze Peru" },
  { word: "BOLIVAR", hint: "Pieniądze Wenezueli" },
  { word: "PESO", hint: "Pieniądze Chile" },
  { word: "GUARANI", hint: "Pieniądze Paragwaju" },
  { word: "SUCRE", hint: "Pieniądze Ekwadoru" },
  { word: "BOLIVIANO", hint: "Pieniądze Boliwii" },
  { word: "COLON", hint: "Pieniądze Kostaryki" },
  { word: "QUETZAL", hint: "Pieniądze Gwatemali" },
  { word: "LEMPIRA", hint: "Pieniądze Hondurasu" },
  { word: "CORDOBA", hint: "Pieniądze Nikaragui" },
  { word: "BALBOA", hint: "Pieniądze Panamy" },
  { word: "COLON", hint: "Pieniądze Salwadoru" },
  { word: "DOLAR", hint: "Pieniądze Australii" },
  { word: "DOLAR", hint: "Pieniądze Kanady" },
  { word: "DOLAR", hint: "Pieniądze Nowej Zelandii" },
  { word: "RAND", hint: "Pieniądze RPA" },
  { word: "NAIRA", hint: "Pieniądze Nigerii" },
  { word: "SHILLING", hint: "Pieniądze Kenii" },
  { word: "BIRR", hint: "Pieniądze Etiopii" },
  { word: "EGIPSKI", hint: "Funt" },
  { word: "DIRHAM", hint: "Pieniądze Maroka" },
  { word: "DINAR", hint: "Pieniądze Tunezji" },
  { word: "DINAR", hint: "Pieniądze Algierii" },
  { word: "DINAR", hint: "Pieniądze Libii" },
  { word: "RIAL", hint: "Pieniądze Iranu" },
  { word: "RIAL", hint: "Pieniądze Omanu" },
  { word: "RIYAL", hint: "Pieniądze Arabii Saudyjskiej" },
  { word: "DIRHAM", hint: "Pieniądze ZEA" },
  { word: "DINAR", hint: "Pieniądze Kuwejtu" },
  { word: "DINAR", hint: "Pieniądze Bahrajnu" },
  { word: "RIAL", hint: "Pieniądze Kataru" },
  { word: "AFGHANI", hint: "Pieniądze Afganistanu" },
  { word: "TAKA", hint: "Pieniądze Bangladeszu" },
  { word: "RUPIA", hint: "Pieniądze Pakistanu" },
  { word: "RUPIA", hint: "Pieniądze Sri Lanki" },
  { word: "RUFIYAA", hint: "Pieniądze Malediwów" },
  { word: "NGULTRUM", hint: "Pieniądze Bhutanu" },
  { word: "KYAT", hint: "Pieniądze Birmy" },
  { word: "KIP", hint: "Pieniądze Laosu" },
  { word: "RIEL", hint: "Pieniądze Kambodży" },
  { word: "TUGRIK", hint: "Pieniądze Mongolii" },
  { word: "SOM", hint: "Pieniądze Kirgistanu" },
  { word: "SOMONI", hint: "Pieniądze Tadżykistanu" },
  { word: "MANAT", hint: "Pieniądze Turkmenistanu" },
  { word: "SUM", hint: "Pieniądze Uzbekistanu" },
  { word: "TENGE", hint: "Pieniądze Kazachstanu" },
  { word: "LARI", hint: "Pieniądze Gruzji" },
  { word: "DRAM", hint: "Pieniądze Armenii" },
  { word: "MANAT", hint: "Pieniądze Azerbejdżanu" },
  { word: "LEU", hint: "Pieniądze Mołdawii" },
  { word: "HRYWNIA", hint: "Pieniądze Ukrainy" },
  { word: "RUBEL", hint: "Pieniądze Białorusi" },
  { word: "RUBEL", hint: "Pieniądze Rosji" },
  { word: "RUBLE", hint: "Pieniądze Rosji" }
];

// Przechowywanie gier
const games = new Map();

class Game {
  constructor(code, hostId, rounds, roundTime, numImpostors, gameMode, customWordData = null, decisionTime = 30) {
    this.code = code;
    this.hostId = hostId;
    this.rounds = parseInt(rounds);
    this.roundTime = parseInt(roundTime);
    this.decisionTime = parseInt(decisionTime) || 30;
    this.numImpostors = parseInt(numImpostors) || 1;
    this.gameMode = gameMode || 'simultaneous';
    this.players = new Map();
    this.currentRound = 0;
    this.isPlaying = false;
    this.isVoting = false;
    this.isDeciding = false;
    this.impostorIds = [];
    this.associations = new Map();
    this.votes = new Map();
    this.voteResults = new Map();
    this.decisions = new Map();
    this.guesses = new Map();
    this.roundStartTime = null;
    this.timer = null;
    this.currentTurnIndex = 0;
    this.turnOrder = [];
    this.turnTimer = null;
    this.votingTimeout = null;
    this.decisionTimeout = null;
    this.chatMessages = [];
    this.customWordData = customWordData;
    
    if (customWordData && customWordData.word && customWordData.hint) {
      this.currentWordPair = customWordData;
      this.word = customWordData.word;
      this.hint = customWordData.hint;
    } else {
      this.currentWordPair = this.getRandomWordPair();
      this.word = this.currentWordPair.word;
      this.hint = this.currentWordPair.hint;
    }
    
    this.wordGuessed = false;
    this.guessFailed = false;
    this.gameEnded = false;
    this.turnTimeLeft = 30;
    this.turnTimerInterval = null;
    this.turnStartTime = null;
    this.turnTimerBroadcastInterval = null;
  }

  getRandomWordPair() {
    const randomIndex = Math.floor(Math.random() * wordPairs.length);
    return wordPairs[randomIndex];
  }

  addPlayer(playerId, name) {
    this.players.set(playerId, {
      id: playerId,
      name: name,
      isImpostor: false,
      isHost: playerId === this.hostId,
      hasSubmitted: false,
      association: '',
      hasDecided: false,
      hasGuessed: false,
      guess: '',
      turnCompleted: false,
      voteSubmitted: false
    });
    
    return this.players.get(playerId);
  }

  removePlayer(playerId) {
    const wasImpostor = this.players.get(playerId)?.isImpostor;
    const wasHost = playerId === this.hostId;
    
    // Usuń gracza z listy
    this.players.delete(playerId);
    
    // Usuń z listy impostorów
    this.impostorIds = this.impostorIds.filter(id => id !== playerId);
    
    // ✅ NAPRAWIONE: Usuń głosy, decyzje i skojarzenia rozłączonego gracza
    this.votes.delete(playerId);
    this.decisions.delete(playerId);
    this.associations.delete(playerId);
    this.guesses.delete(playerId);
    
    // ✅ NAPRAWIONE: Usuń głosy NA rozłączonego gracza
    for (const [voterId, votedId] of this.votes.entries()) {
      if (votedId === playerId) {
        this.votes.delete(voterId);
        const voter = this.players.get(voterId);
        if (voter) {
          voter.voteSubmitted = false;
        }
      }
    }
    
    // ✅ NAPRAWIONE: Sprawdź czy można kontynuować głosowanie/decyzje po rozłączeniu gracza
    let shouldProcessVotes = false;
    let shouldProcessDecision = false;
    let voteResults = null;
    let decisionResult = null;
    
    if (this.isVoting && this.players.size > 0) {
      const allVoted = Array.from(this.players.values())
        .every(p => this.votes.has(p.id));
      if (allVoted) {
        shouldProcessVotes = true;
        voteResults = this.calculateVoteResults();
      }
    }
    
    if (this.isDeciding && this.players.size > 0) {
      const allDecided = Array.from(this.players.values())
        .every(p => p.hasDecided);
      if (allDecided) {
        shouldProcessDecision = true;
        decisionResult = this.calculateDecisionResult();
      }
    }
    
    // ✅ NAPRAWIONE: Sprawdź minimalną liczbę graczy (minimum 3 do gry)
    if (this.isPlaying && this.players.size < 3) {
      this.isPlaying = false;
      this.gameEnded = true;
    }
    
    // Zwróć informacje o stanie
    if (wasHost) {
      return { 
        wasHost: true,
        shouldProcessVotes,
        shouldProcessDecision,
        voteResults,
        decisionResult
      };
    }
    
    return { 
      wasHost: false,
      shouldProcessVotes,
      shouldProcessDecision,
      voteResults,
      decisionResult
    };
  }

  startGame() {
    this.isPlaying = true;
    this.currentRound = 1;
    this.wordGuessed = false;
    this.guessFailed = false;
    this.gameEnded = false;
    this.chatMessages = [];
    
    // Wybierz impostorów - host też może być impostorem!
    this.impostorIds = [];
    const allPlayers = Array.from(this.players.values());
    
    // Zresetuj role wszystkich graczy
    for (const player of allPlayers) {
      player.isImpostor = false;
      player.hasSubmitted = false;
      player.association = '';
      player.hasDecided = false;
      player.hasGuessed = false;
      player.guess = '';
      player.turnCompleted = false;
      player.voteSubmitted = false;
    }
    
    // Losowo wybierz impostorów spośród WSZYSTKICH graczy (w tym hosta)
    const shuffled = [...allPlayers].sort(() => 0.5 - Math.random());
    const impostorCount = Math.min(this.numImpostors, allPlayers.length);
    
    for (let i = 0; i < impostorCount; i++) {
      const impostorId = shuffled[i].id;
      this.impostorIds.push(impostorId);
      const player = this.players.get(impostorId);
      if (player) {
        player.isImpostor = true;
      }
    }
    
    console.log(`Game ${this.code}: Assigned impostors: ${this.impostorIds.join(', ')}`);
    
    this.associations.clear();
    this.votes.clear();
    this.voteResults.clear();
    this.decisions.clear();
    this.guesses.clear();
    
    // Jeśli nie ma custom słowa, losuj nowe
    if (!this.customWordData) {
      this.currentWordPair = this.getRandomWordPair();
      this.word = this.currentWordPair.word;
      this.hint = this.currentWordPair.hint;
    }
    
    if (this.gameMode === 'sequential') {
      this.prepareTurnOrder();
      // Uruchom timer dla pierwszego gracza
      const firstPlayerId = this.getCurrentTurnPlayerId();
      if (firstPlayerId) {
        this.turnStartTime = Date.now();
        this.turnTimeLeft = 30;
      }
    }
    
    return this.getGameState();
  }

  prepareTurnOrder() {
    const allPlayers = Array.from(this.players.values());
    this.turnOrder = [...allPlayers].sort(() => 0.5 - Math.random()).map(p => p.id);
    this.currentTurnIndex = 0;
  }

  getCurrentTurnPlayerId() {
    if (this.currentTurnIndex < this.turnOrder.length) {
      return this.turnOrder[this.currentTurnIndex];
    }
    return null;
  }

  nextTurn() {
    const currentPlayerId = this.getCurrentTurnPlayerId();
    if (currentPlayerId) {
      const player = this.players.get(currentPlayerId);
      if (player) {
        player.turnCompleted = true;
      }
    }
    
    this.currentTurnIndex++;
    
    // Znajdź następnego gracza, który jeszcze nie wysłał skojarzenia
    while (this.currentTurnIndex < this.turnOrder.length) {
      const nextPlayerId = this.turnOrder[this.currentTurnIndex];
      const nextPlayer = this.players.get(nextPlayerId);
      if (nextPlayer && !nextPlayer.hasSubmitted) {
        return nextPlayerId;
      }
      this.currentTurnIndex++;
    }
    
    // Jeśli wszyscy gracze już wysłali lub nie ma więcej graczy
    return null;
  }

  submitAssociation(playerId, association) {
    const player = this.players.get(playerId);
    if (!player) return false;
    
    // Jeśli gracz już wysłał skojarzenie, nie pozwól wysłać ponownie
    if (player.hasSubmitted) return false;
    
    player.association = association;
    player.hasSubmitted = true;
    this.associations.set(playerId, association);
    
    if (this.gameMode === 'sequential') {
      // Sprawdź czy wszyscy gracze wysłali skojarzenia
      const allPlayers = Array.from(this.players.values());
      const allSubmitted = allPlayers.every(p => p.hasSubmitted);
      
      return allSubmitted;
    } else {
      // W trybie simultaneous - WSZYSCY gracze (w tym impostorzy) mogą wysyłać skojarzenia w każdej rundzie
      const allPlayers = Array.from(this.players.values());
      const allSubmitted = allPlayers.every(p => p.hasSubmitted);
      
      return allSubmitted;
    }
  }

  submitGuess(playerId, guess) {
    const player = this.players.get(playerId);
    if (!player || !player.isImpostor) return false;
    
    player.hasGuessed = true;
    player.guess = guess;
    this.guesses.set(playerId, guess);
    
    // ✅ NAPRAWIONE: Zatrzymaj wszystkie timery przed zakończeniem gry
    if (this.turnTimerBroadcastInterval) {
      clearInterval(this.turnTimerBroadcastInterval);
      this.turnTimerBroadcastInterval = null;
    }
    if (this.votingTimeout) {
      clearTimeout(this.votingTimeout);
      this.votingTimeout = null;
    }
    if (this.decisionTimeout) {
      clearTimeout(this.decisionTimeout);
      this.decisionTimeout = null;
    }
    
    const guessedCorrectly = guess.trim().toLowerCase() === this.word.toLowerCase();
    
    if (guessedCorrectly) {
      this.wordGuessed = true;
      this.isPlaying = false;
      this.gameEnded = true;
      return {
        correct: true,
        guesserId: playerId,
        guesserName: player.name
      };
    } else {
      this.guessFailed = true;
      this.isPlaying = false;
      this.gameEnded = true;
      return {
        correct: false,
        guesserId: playerId,
        guesserName: player.name
      };
    }
  }
  
  // ✅ NOWA FUNKCJA: Zatrzymaj wszystkie timery
  stopAllTimers() {
    if (this.turnTimerBroadcastInterval) {
      clearInterval(this.turnTimerBroadcastInterval);
      this.turnTimerBroadcastInterval = null;
    }
    if (this.votingTimeout) {
      clearTimeout(this.votingTimeout);
      this.votingTimeout = null;
    }
    if (this.decisionTimeout) {
      clearTimeout(this.decisionTimeout);
      this.decisionTimeout = null;
    }
  }
  
  // ✅ NOWA FUNKCJA: Uruchom timer dla aktualnego gracza w trybie sequential
  startTurnTimerForCurrentPlayer(gameCode, io) {
    // Zawsze zatrzymaj poprzedni timer
    this.stopAllTimers();
    
    if (this.gameMode !== 'sequential' || !this.isPlaying || this.wordGuessed || this.guessFailed) {
      return;
    }
    
    const currentPlayerId = this.getCurrentTurnPlayerId();
    if (!currentPlayerId) {
      return;
    }
    
    // Ustaw czas startu
    this.turnStartTime = Date.now();
    this.turnTimeLeft = 30;
    
    // Wyślij początkowy czas
    io.to(gameCode).emit('turnTimerUpdate', {
      timeLeft: this.turnTimeLeft,
      gameState: this.getGameState()
    });
    
    // Rozpocznij broadcast timera
    this.turnTimerBroadcastInterval = setInterval(() => {
      if (!this.isPlaying || this.wordGuessed || this.guessFailed || this.gameMode !== 'sequential') {
        if (this.turnTimerBroadcastInterval) {
          clearInterval(this.turnTimerBroadcastInterval);
          this.turnTimerBroadcastInterval = null;
        }
        return;
      }
      
      const currentId = this.getCurrentTurnPlayerId();
      if (!currentId || currentId !== currentPlayerId) {
        // Gracz się zmienił, zatrzymaj timer
        if (this.turnTimerBroadcastInterval) {
          clearInterval(this.turnTimerBroadcastInterval);
          this.turnTimerBroadcastInterval = null;
        }
        return;
      }
      
      const elapsed = Math.floor((Date.now() - this.turnStartTime) / 1000);
      this.turnTimeLeft = Math.max(0, 30 - elapsed);
      
      io.to(gameCode).emit('turnTimerUpdate', {
        timeLeft: this.turnTimeLeft,
        gameState: this.getGameState()
      });
      
      // Jeśli czas się skończył
      if (this.turnTimeLeft <= 0) {
        if (this.turnTimerBroadcastInterval) {
          clearInterval(this.turnTimerBroadcastInterval);
          this.turnTimerBroadcastInterval = null;
        }
        
        const currentPlayer = this.players.get(currentPlayerId);
        if (currentPlayer && !currentPlayer.hasSubmitted) {
          this.submitAssociation(currentPlayerId, '');
          io.to(gameCode).emit('associationSubmitted', {
            playerId: currentPlayerId,
            association: '',
            gameState: this.getGameState()
          });
          
          // Przejdź do następnego gracza
          const nextPlayerId = this.nextTurn();
          if (nextPlayerId) {
            this.startTurnTimerForCurrentPlayer(gameCode, io);
            io.to(gameCode).emit('nextTurn', {
              nextPlayerId: nextPlayerId,
              gameState: this.getGameState()
            });
          } else {
            setTimeout(() => {
              this.startDecisionPhase();
              io.to(gameCode).emit('decisionPhaseStarted', {
                gameState: this.getGameState()
              });
            }, 1500);
          }
        }
      }
    }, 1000);
  }

  startDecisionPhase() {
    this.isDeciding = true;
    this.isVoting = false;
    this.decisions.clear();
    
    // Zatrzymaj timer tury jeśli działa
    if (this.turnTimerBroadcastInterval) {
      clearInterval(this.turnTimerBroadcastInterval);
      this.turnTimerBroadcastInterval = null;
    }
    
    for (const player of this.players.values()) {
      player.hasDecided = false;
    }
    
    // Wyczyść poprzedni timeout jeśli istnieje
    if (this.decisionTimeout) {
      clearTimeout(this.decisionTimeout);
    }
    
    // Ustaw timeout dla fazy decyzji
    this.decisionTimeout = setTimeout(() => {
      if (this.isDeciding && this.isPlaying) {
        console.log(`Game ${this.code}: Decision timeout - forcing decision calculation`);
        
        // Automatycznie dodaj decyzje dla graczy którzy nie zdecydowali
        for (const player of this.players.values()) {
          if (!player.hasDecided) {
            // Domyślnie głosuj na kontynuację (false)
            player.hasDecided = true;
            this.decisions.set(player.id, false);
          }
        }
        
        const decisionResult = this.calculateDecisionResult();
        
        // Powiadom wszystkich graczy i przetwórz wynik
        setTimeout(() => {
          if (decisionResult.majorityWantsVote) {
            this.startVoting();
            io.to(this.code).emit('votingStarted', {
              decisionResult,
              gameState: this.getGameState()
            });
          } else {
            this.nextRound(true);
            io.to(this.code).emit('nextRoundStarted', {
              gameState: this.getGameState()
            });
          }
        }, 500);
      }
    }, this.decisionTime * 1000);
    
    return this.getGameState();
  }

  submitDecision(playerId, decision) {
    const player = this.players.get(playerId);
    if (!player || !this.isDeciding) return false;
    
    player.hasDecided = true;
    this.decisions.set(playerId, decision);
    
    const allDecided = Array.from(this.players.values())
      .every(p => p.hasDecided);
    
    if (allDecided) {
      return this.calculateDecisionResult();
    }
    
    return null;
  }

  calculateDecisionResult() {
    let voteCount = 0;
    let continueCount = 0;
    
    for (const decision of this.decisions.values()) {
      if (decision) {
        voteCount++;
      } else {
        continueCount++;
      }
    }
    
    // Jeśli remis - losuj
    let majorityWantsVote = voteCount > continueCount;
    if (voteCount === continueCount) {
      majorityWantsVote = Math.random() < 0.5;
    }
    
    return {
      voteCount,
      continueCount,
      majorityWantsVote
    };
  }

  startVoting() {
    this.isVoting = true;
    this.isDeciding = false;
    this.votes.clear();
    
    // Resetuj stan głosowania dla wszystkich graczy
    for (const player of this.players.values()) {
      player.voteSubmitted = false;
    }
    
    if (this.votingTimeout) {
      clearTimeout(this.votingTimeout);
    }
    
    // Użyj tego samego czasu co dla decyzji
    this.votingTimeout = setTimeout(() => {
      if (this.isVoting && this.isPlaying) {
        console.log(`Game ${this.code}: Voting timeout - forcing vote calculation`);
        
        // Automatycznie dodaj głosy dla graczy którzy nie zagłosowali (losowy głos)
        for (const player of this.players.values()) {
          if (!player.voteSubmitted) {
            // Losuj gracza na którego zagłosować (nie można głosować na siebie)
            const availablePlayers = Array.from(this.players.values())
              .filter(p => p.id !== player.id)
              .map(p => p.id);
            
            if (availablePlayers.length > 0) {
              const randomPlayerId = availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
              player.voteSubmitted = true;
              this.votes.set(player.id, randomPlayerId);
              console.log(`Game ${this.code}: Auto-vote for ${player.name} -> ${this.players.get(randomPlayerId)?.name}`);
            }
          }
        }
        
        const voteResults = this.calculateVoteResults();
        // ✅ NAPRAWIONE: Zapisz wynik tylko raz (było wywołane 2 razy)
        const outcome = this.handleVoteResults(voteResults);
        
        // Powiadom wszystkich graczy
        io.to(this.code).emit('voteResults', {
          results: voteResults,
          outcome: outcome,  // ✅ Użyj zapisanego wyniku zamiast wywoływać ponownie
          gameState: this.getGameState()
        });
        
        // ✅ NAPRAWIONE: Obsługa zakończenia gry po timeout
        if (outcome.gameEnded) {
          setTimeout(() => {
            io.to(this.code).emit('gameEnded', {
              reason: 'allImpostorsFound',
              gameState: this.getGameState()
            });
          }, 3000);
        }
      }
    }, this.decisionTime * 1000);
    
    return this.getGameState();
  }

  submitVote(voterId, votedPlayerId) {
    // Sprawdź czy gracz, na którego głosujemy, istnieje
    if (!this.players.has(votedPlayerId)) {
      console.log(`Game ${this.code}: Invalid vote - player ${votedPlayerId} doesn't exist`);
      return null;
    }
    
    const voter = this.players.get(voterId);
    if (!voter) {
      console.log(`Game ${this.code}: Invalid voter - player ${voterId} doesn't exist`);
      return null;
    }
    
    voter.voteSubmitted = true;
    this.votes.set(voterId, votedPlayerId);
    
    const allVoted = Array.from(this.players.values())
      .every(p => this.votes.has(p.id));
    
    if (allVoted) {
      if (this.votingTimeout) {
        clearTimeout(this.votingTimeout);
        this.votingTimeout = null;
      }
      
      return this.calculateVoteResults();
    }
    
    return null;
  }

  calculateVoteResults() {
    const voteCounts = new Map();
    
    // Zlicz głosy, ignorując głosy na nieistniejących graczy
    for (const votedId of this.votes.values()) {
      // Sprawdź czy gracz o takim ID istnieje
      if (this.players.has(votedId)) {
        voteCounts.set(votedId, (voteCounts.get(votedId) || 0) + 1);
      }
    }
    
    let maxVotes = 0;
    let votedOutIds = [];
    
    // Znajdź gracza z największą liczbą głosów
    for (const [playerId, count] of voteCounts) {
      if (count > maxVotes) {
        maxVotes = count;
        votedOutIds = [playerId];
      } else if (count === maxVotes && maxVotes > 0) {
        votedOutIds.push(playerId);
      }
    }
    
    this.voteResults = voteCounts;
    
    // Jeśli remis (więcej niż 1 gracz z max głosami) - losuj
    if (votedOutIds.length > 1 && maxVotes > 0) {
      const randomIndex = Math.floor(Math.random() * votedOutIds.length);
      votedOutIds = [votedOutIds[randomIndex]];
      console.log(`Game ${this.code}: Vote tie - random choice: ${votedOutIds[0]}`);
    }
    
    // Jeśli brak głosów lub remis z 0 głosami
    if (votedOutIds.length !== 1) {
      return {
        votedOutIds: [],
        voteCounts: Array.from(voteCounts.entries()),
        maxVotes,
        isTie: maxVotes > 0
      };
    }
    
    return {
      votedOutIds,
      voteCounts: Array.from(voteCounts.entries()),
      maxVotes,
      isTie: false
    };
  }

  handleVoteResults(voteResults) {
    // Jeśli jest remis lub brak głosów
    if (voteResults.isTie || voteResults.votedOutIds.length !== 1) {
      return {
        type: 'noOneVotedOut',
        impostorsRemaining: this.impostorIds.length,
        isTie: true
      };
    }
    
    const votedOutId = voteResults.votedOutIds[0];
    const wasImpostor = this.impostorIds.includes(votedOutId);
    
    if (wasImpostor) {
      const player = this.players.get(votedOutId);
      if (player) {
        player.isImpostor = false;
      }
      this.impostorIds = this.impostorIds.filter(id => id !== votedOutId);
      
      if (this.impostorIds.length === 0) {
        this.isPlaying = false;
        this.gameEnded = true;
        return {
          type: 'impostorVotedOut',
          votedOutId,
          wasImpostor: true,
          impostorsRemaining: 0,
          gameEnded: true
        };
      }
      
      return {
        type: 'impostorVotedOut',
        votedOutId,
        wasImpostor: true,
        impostorsRemaining: this.impostorIds.length
      };
    } else {
      // Niewinny gracz został wybrany
      return {
        type: 'innocentVotedOut',
        votedOutId,
        wasImpostor: false,
        impostorsRemaining: this.impostorIds.length
      };
    }
  }

  nextRound(keepSameWord = false) {
    // Sprawdź czy to już ostatnia runda - jeśli tak, przejdź do głosowania
    if (this.currentRound >= this.rounds) {
      this.startVoting();
      return this.getGameState();
    }
    
    this.currentRound++;
    this.isVoting = false;
    this.isDeciding = false;
    this.wordGuessed = false;
    this.guessFailed = false;
    this.isPlaying = true;
    
    // Resetujemy stan graczy
    for (const player of this.players.values()) {
      player.hasSubmitted = false;
      player.association = '';
      player.hasDecided = false;
      player.hasGuessed = false;
      player.guess = '';
      player.turnCompleted = false;
      player.voteSubmitted = false;
    }
    
    this.associations.clear();
    this.votes.clear();
    this.voteResults.clear();
    this.decisions.clear();
    this.guesses.clear();
    
    // Losuj nowe słowo dla każdej nowej rundy (chyba że host chce zachować)
    if (!keepSameWord) {
      this.currentWordPair = this.getRandomWordPair();
      this.word = this.currentWordPair.word;
      this.hint = this.currentWordPair.hint;
    }
    
    // Dla trybu sequential przygotuj nową kolejkę
    if (this.gameMode === 'sequential') {
      this.prepareTurnOrder();
    }
    
    if (this.votingTimeout) {
      clearTimeout(this.votingTimeout);
      this.votingTimeout = null;
    }
    
    if (this.decisionTimeout) {
      clearTimeout(this.decisionTimeout);
      this.decisionTimeout = null;
    }
    
    // Zatrzymaj timer tury jeśli działa
    if (this.turnTimerBroadcastInterval) {
      clearInterval(this.turnTimerBroadcastInterval);
      this.turnTimerBroadcastInterval = null;
    }
    
    return this.getGameState();
  }

  endGame() {
    this.isPlaying = false;
    this.gameEnded = true;
    return this.getGameState();
  }

  addChatMessage(playerId, message, type = 'chat') {
    const player = this.players.get(playerId);
    let playerName = 'SYSTEM';
    
    if (player) {
      playerName = player.name;
    } else if (type === 'system') {
      playerName = 'SYSTEM';
    }
    
    const chatMessage = {
      id: Date.now(),
      playerId: playerId,
      playerName: playerName,
      message: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      round: this.currentRound,
      type: type
    };
    
    this.chatMessages.push(chatMessage);
    
    // Ogranicz historię czatu do ostatnich 50 wiadomości
    if (this.chatMessages.length > 50) {
      this.chatMessages = this.chatMessages.slice(-50);
    }
    
    return chatMessage;
  }

  getGameState(playerId = null) {
    const associationsWithNames = Array.from(this.associations.entries()).map(([id, association]) => {
      const player = this.players.get(id);
      return {
        playerId: id,
        playerName: player ? player.name : 'Nieznany',
        association: association,
        isImpostor: player ? player.isImpostor : false,
        hasSubmitted: player ? player.hasSubmitted : false
      };
    });

    const state = {
      code: this.code,
      word: this.word,
      hint: this.hint,
      rounds: this.rounds,
      roundTime: this.roundTime,
      decisionTime: this.decisionTime,
      numImpostors: this.numImpostors,
      gameMode: this.gameMode,
      currentRound: this.currentRound,
      isPlaying: this.isPlaying,
      isVoting: this.isVoting,
      isDeciding: this.isDeciding,
      wordGuessed: this.wordGuessed,
      guessFailed: this.guessFailed,
      gameEnded: this.gameEnded,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        isImpostor: p.isImpostor,
        isHost: p.isHost,
        hasSubmitted: p.hasSubmitted,
        hasDecided: p.hasDecided,
        hasGuessed: p.hasGuessed,
        turnCompleted: p.turnCompleted,
        voteSubmitted: p.voteSubmitted,
        association: this.isVoting || this.isDeciding ? p.association : '',
        guess: p.guess
      })),
      associations: associationsWithNames,
      votes: Array.from(this.votes.entries()),
      voteResults: Array.from(this.voteResults.entries()),
      decisions: Array.from(this.decisions.entries()),
      guesses: Array.from(this.guesses.entries()),
      impostorIds: this.impostorIds,
      currentTurnPlayerId: this.gameMode === 'sequential' ? this.getCurrentTurnPlayerId() : null,
      turnOrder: this.gameMode === 'sequential' ? this.turnOrder : [],
      chatMessages: this.chatMessages
    };
    
    if (playerId) {
      const player = this.players.get(playerId);
      if (player) {
        // impostor widzi podpowiedź, nie hasło
        if (player.isImpostor && this.isPlaying && !this.wordGuessed && !this.guessFailed) {
          state.playerWord = this.hint; // TYLKO podpowiedź dla impostora
          state.isImpostor = true;
          
          state.coImpostors = this.impostorIds
            .filter(id => id !== playerId)
            .map(id => {
              const coImpostor = this.players.get(id);
              return coImpostor ? coImpostor.name : 'Nieznany';
            });
        } else {
          state.playerWord = this.word; // Gracz widzi hasło
          state.isImpostor = false;
        }
        
        state.player = {
          id: player.id,
          name: player.name,
          isImpostor: player.isImpostor,
          isHost: player.isHost
        };
      }
    }
    
    return state;
  }
}

function generateGameCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

io.on('connection', (socket) => {
  console.log('Nowe połączenie:', socket.id);
  
  socket.on('createGame', (data) => {
    try {
      console.log('Otrzymano createGame:', data);
      const { playerName, rounds, roundTime, numImpostors, gameMode, customWordData, decisionTime } = data;
      
      let code;
      do {
        code = generateGameCode();
      } while (games.has(code));
      
      const game = new Game(code, socket.id, rounds, roundTime, numImpostors, gameMode, customWordData, decisionTime);
      games.set(code, game);
      
      game.addPlayer(socket.id, playerName || 'Host');
      
      socket.join(code);
      socket.gameCode = code;
      
      const gameState = game.getGameState(socket.id);
      console.log('Wysyłanie gameCreated dla:', socket.id, 'Kod:', code);
      
      socket.emit('gameCreated', { 
        code,
        gameState: gameState
      });
      
      console.log(`Gra utworzona: ${code} przez ${socket.id}`);
    } catch (error) {
      console.error('Błąd przy tworzeniu gry:', error);
      socket.emit('error', { message: 'Błąd przy tworzeniu gry: ' + error.message });
    }
  });
  
  socket.on('joinGame', (data) => {
    const { code, playerName } = data;
    
    if (!games.has(code)) {
      socket.emit('error', { message: 'Gra o podanym kodzie nie istnieje' });
      return;
    }
    
    const game = games.get(code);
    
    if (game.isPlaying) {
      socket.emit('error', { message: 'Gra już się rozpoczęła' });
      return;
    }
    
    const player = game.addPlayer(socket.id, playerName);
    
    socket.join(code);
    socket.gameCode = code;
    
    socket.emit('gameJoined', { 
      gameState: game.getGameState(socket.id)
    });
    
    io.to(code).emit('playerJoined', {
      player,
      gameState: game.getGameState()
    });
    
    console.log(`Gracz dołączył: ${playerName} do gry ${code}`);
  });
  
  socket.on('startGame', () => {
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (socket.id !== game.hostId) return;
    
    if (game.players.size < 3) {
      socket.emit('error', { message: 'Potrzeba co najmniej 3 graczy aby rozpocząć grę' });
      return;
    }
    
    game.startGame();
    
    // ✅ NAPRAWIONE: Uruchom timer dla pierwszego gracza w trybie sequential
    if (game.gameMode === 'sequential') {
      game.startTurnTimerForCurrentPlayer(gameCode, io);
    }
    
    io.to(gameCode).emit('gameStarted', {
      gameState: game.getGameState()
    });
    
    console.log(`Gra rozpoczęta: ${gameCode}`);
  });
  
  socket.on('submitAssociation', (data) => {
    const { association } = data;
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (!game.isPlaying || game.isVoting || game.isDeciding || game.wordGuessed || game.guessFailed) return;
    
    if (game.gameMode === 'sequential') {
      const currentTurnPlayerId = game.getCurrentTurnPlayerId();
      if (currentTurnPlayerId !== socket.id) {
        socket.emit('error', { message: 'Nie twoja kolej!' });
        return;
      }
    }
    
    const allSubmitted = game.submitAssociation(socket.id, association);
    
    // ✅ NAPRAWIONE: Dodaj wiadomość do czatu dla wszystkich trybów
    const player = game.players.get(socket.id);
    if (player) {
      const chatMessage = game.addChatMessage(socket.id, association || '(pominął)', 'association');
      io.to(gameCode).emit('newChatMessage', {
        chatMessage,
        gameState: game.getGameState()
      });
    }
    
    // Wyślij zaktualizowany stan gry do wszystkich
    const gameState = game.getGameState();
    io.to(gameCode).emit('associationSubmitted', {
      playerId: socket.id,
      association: association,
      gameState: gameState
    });
    
    if (game.gameMode === 'sequential') {
      const nextPlayerId = game.nextTurn();
      if (nextPlayerId) {
        // ✅ NAPRAWIONE: Użyj nowej funkcji do uruchomienia timera
        game.startTurnTimerForCurrentPlayer(gameCode, io);
        
        io.to(gameCode).emit('nextTurn', {
          nextPlayerId: nextPlayerId,
          gameState: game.getGameState()
        });
      } else {
        // Zatrzymaj timer
        if (game.turnTimerBroadcastInterval) {
          clearInterval(game.turnTimerBroadcastInterval);
          game.turnTimerBroadcastInterval = null;
        }
        
        // Wszyscy gracze zakończyli tury
        setTimeout(() => {
          game.startDecisionPhase();
          io.to(gameCode).emit('decisionPhaseStarted', {
            gameState: game.getGameState()
          });
        }, 1500);
      }
    } else if (allSubmitted) {
      setTimeout(() => {
        game.startDecisionPhase();
        io.to(gameCode).emit('decisionPhaseStarted', {
          gameState: game.getGameState()
        });
      }, 1500);
    }
  });
  
  socket.on('submitGuess', (data) => {
    const { guess } = data;
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (!game.isPlaying || game.wordGuessed || game.guessFailed) return;
    
    // Dodaj wiadomość do czatu
    const player = game.players.get(socket.id);
    if (player) {
      const chatMessage = game.addChatMessage(socket.id, `Zgadł: "${guess}"`, 'guess');
      io.to(gameCode).emit('newChatMessage', {
        chatMessage,
        gameState: game.getGameState()
      });
      
      // Powiadom o zgadywaniu
      io.to(gameCode).emit('guessSubmitted', {
        playerId: socket.id,
        guess: guess,
        gameState: game.getGameState()
      });
    }
    
    const result = game.submitGuess(socket.id, guess);
    
    if (result) {
      if (result.correct) {
        io.to(gameCode).emit('wordGuessed', {
          guesserId: result.guesserId,
          guesserName: result.guesserName,
          word: game.word,
          gameState: game.getGameState()
        });
        
        // ✅ NAPRAWIONE: Zatrzymaj wszystkie timery
        game.stopAllTimers();
        
        // ✅ NAPRAWIONE: Pokaż ekran końcowy od razu, bez czekania
        setTimeout(() => {
          io.to(gameCode).emit('gameEnded', {
            reason: 'wordGuessed',
            gameState: game.getGameState()
          });
        }, 1000);
      } else {
        io.to(gameCode).emit('guessFailed', {
          guesserId: result.guesserId,
          guesserName: result.guesserName,
          word: game.word,
          gameState: game.getGameState()
        });
        
        // ✅ NAPRAWIONE: Zatrzymaj wszystkie timery
        game.stopAllTimers();
        
        // ✅ NAPRAWIONE: Pokaż ekran końcowy od razu
        setTimeout(() => {
          io.to(gameCode).emit('gameEnded', {
            reason: 'guessFailed',
            gameState: game.getGameState()
          });
        }, 1000);
      }
    }
  });
  
  socket.on('submitDecision', (data) => {
    const { decision } = data;
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (!game.isPlaying || !game.isDeciding || game.wordGuessed || game.guessFailed) return;
    
    const decisionResult = game.submitDecision(socket.id, decision);
    
    io.to(gameCode).emit('decisionSubmitted', {
      playerId: socket.id,
      gameState: game.getGameState()
    });
    
    if (decisionResult) {
      if (game.decisionTimeout) {
        clearTimeout(game.decisionTimeout);
        game.decisionTimeout = null;
      }
      
      setTimeout(() => {
        if (decisionResult.majorityWantsVote) {
          game.startVoting();
          io.to(gameCode).emit('votingStarted', {
            decisionResult,
            gameState: game.getGameState()
          });
        } else {
          game.nextRound(true);
          io.to(gameCode).emit('nextRoundStarted', {
            gameState: game.getGameState()
          });
        }
      }, 1500);
    }
  });
  
  socket.on('submitVote', (data) => {
    const { votedPlayerId } = data;
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (!game.isPlaying || !game.isVoting || game.wordGuessed || game.guessFailed) return;
    
    const voteResults = game.submitVote(socket.id, votedPlayerId);
    
    io.to(gameCode).emit('voteSubmitted', {
      voterId: socket.id,
      gameState: game.getGameState()
    });
    
    if (voteResults) {
      setTimeout(() => {
        const voteOutcome = game.handleVoteResults(voteResults);
        
        // Wyślij wyniki głosowania do wszystkich graczy
        io.to(gameCode).emit('voteResults', {
          results: voteResults,
          outcome: voteOutcome,
          gameState: game.getGameState()
        });
        
        // Jeśli gra się zakończyła po głosowaniu
        if (voteOutcome.gameEnded) {
          setTimeout(() => {
            io.to(gameCode).emit('gameEnded', {
              reason: 'allImpostorsFound',
              gameState: game.getGameState()
            });
          }, 3000);
        }
      }, 1500);
    }
  });
  
  socket.on('nextRound', (data = {}) => {
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (socket.id !== game.hostId) return;
    
    const { keepSameWord = false } = data;
    
    // Sprawdź czy gra się już zakończyła
    if (game.gameEnded) {
      return;
    }
    
    // Jeśli to ostatnia runda, przejdź do głosowania
    if (game.currentRound >= game.rounds) {
      game.startVoting();
      io.to(gameCode).emit('votingStarted', {
        gameState: game.getGameState()
      });
      return;
    }
    
    // Jeśli nie ma już impostorów
    if (game.impostorIds.length === 0) {
      io.to(gameCode).emit('gameEnded', {
        reason: 'allImpostorsFound',
        gameState: game.getGameState()
      });
      return;
    }
    
    game.nextRound(keepSameWord);
    
    const gameState = game.getGameState();
    
    // ✅ NAPRAWIONE: Uruchom timer dla pierwszego gracza w trybie sequential po nowej rundzie
    if (game.gameMode === 'sequential' && game.isPlaying) {
      game.startTurnTimerForCurrentPlayer(gameCode, io);
    }
    
    io.to(gameCode).emit('nextRoundStarted', {
      gameState: gameState
    });
  });
  
  socket.on('endGame', () => {
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (socket.id !== game.hostId) return;
    
    game.endGame();
    
    io.to(gameCode).emit('gameEnded', {
      reason: 'manual',
      gameState: game.getGameState()
    });
  });
  
  socket.on('restartGame', () => {
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) {
      socket.emit('error', { message: 'Gra nie istnieje' });
      return;
    }
    
    const game = games.get(gameCode);
    
    // ✅ NAPRAWIONE: Sprawdź czy gracz jest hostem
    if (socket.id !== game.hostId) {
      socket.emit('error', { message: 'Tylko host może zrestartować grę' });
      return;
    }
    
    // Sprawdź czy host nadal istnieje w grze
    if (!game.players.has(game.hostId)) {
      socket.emit('error', { message: 'Host opuścił grę' });
      return;
    }
    
    // Zatrzymaj wszystkie timery
    if (game.turnTimerBroadcastInterval) {
      clearInterval(game.turnTimerBroadcastInterval);
      game.turnTimerBroadcastInterval = null;
    }
    if (game.votingTimeout) {
      clearTimeout(game.votingTimeout);
      game.votingTimeout = null;
    }
    if (game.decisionTimeout) {
      clearTimeout(game.decisionTimeout);
      game.decisionTimeout = null;
    }
    
    // Resetuj stan gry
    game.isPlaying = false;
    game.isVoting = false;
    game.isDeciding = false;
    game.gameEnded = false;
    game.wordGuessed = false;
    game.guessFailed = false;
    game.currentRound = 0;
    
    // ✅ NAPRAWIONE: Losuj nowych impostorów przy restarcie
    game.impostorIds = [];
    const allPlayers = Array.from(game.players.values());
    
    // Zresetuj role wszystkich graczy
    for (const player of allPlayers) {
      player.isImpostor = false;
      player.hasSubmitted = false;
      player.association = '';
      player.hasDecided = false;
      player.hasGuessed = false;
      player.guess = '';
      player.turnCompleted = false;
      player.voteSubmitted = false;
    }
    
    // Losowo wybierz nowych impostorów spośród WSZYSTKICH graczy (w tym hosta)
    const shuffled = [...allPlayers].sort(() => 0.5 - Math.random());
    const impostorCount = Math.min(game.numImpostors, allPlayers.length);
    
    for (let i = 0; i < impostorCount; i++) {
      const impostorId = shuffled[i].id;
      game.impostorIds.push(impostorId);
      const player = game.players.get(impostorId);
      if (player) {
        player.isImpostor = true;
      }
    }
    
    console.log(`Game ${gameCode}: Restart - New impostors assigned: ${game.impostorIds.join(', ')}`);
    
    // Wyczyść wszystkie dane rundy
    game.associations.clear();
    game.votes.clear();
    game.voteResults.clear();
    game.decisions.clear();
    game.guesses.clear();
    game.chatMessages = [];
    
    // ✅ NAPRAWIONE: Wyczyść customWordData i zawsze losuj nowe słowo przy restarcie
    game.customWordData = null;
    game.currentWordPair = game.getRandomWordPair();
    game.word = game.currentWordPair.word;
    game.hint = game.currentWordPair.hint;
    
    // Wyślij event do wszystkich graczy, żeby wrócili do lobby
    io.to(gameCode).emit('gameRestarted', {
      gameState: game.getGameState()
    });
    
    console.log(`Gra zrestartowana: ${gameCode}`);
  });
  
  socket.on('sendChatMessage', (data) => {
    const { message } = data;
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (!game.isPlaying) return;
    
    const chatMessage = game.addChatMessage(socket.id, message, 'chat');
    
    if (chatMessage) {
      io.to(gameCode).emit('newChatMessage', {
        chatMessage,
        gameState: game.getGameState()
      });
    }
  });
  
  socket.on('disconnect', () => {
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) {
      console.log('Rozłączono:', socket.id);
      return;
    }
    
    const game = games.get(gameCode);
    
    // ✅ NAPRAWIONE: Poprawiona obsługa rozłączenia gracza
    const removeResult = game.removePlayer(socket.id);
    
    if (removeResult.wasHost) {
      io.to(gameCode).emit('hostDisconnected');
      games.delete(gameCode);
      console.log(`Gra zakończona: ${gameCode} (host wyszedł)`);
    } else if (game.players.size === 0) {
      games.delete(gameCode);
      console.log(`Gra usunięta: ${gameCode} (brak graczy)`);
    } else {
      // ✅ NAPRAWIONE: Automatyczne przetwarzanie głosowania/decyzji jeśli warunki są spełnione
      if (removeResult.shouldProcessVotes && removeResult.voteResults) {
        setTimeout(() => {
          const voteOutcome = game.handleVoteResults(removeResult.voteResults);
          
          io.to(gameCode).emit('voteResults', {
            results: removeResult.voteResults,
            outcome: voteOutcome,
            gameState: game.getGameState()
          });
          
          if (voteOutcome.gameEnded) {
            setTimeout(() => {
              io.to(gameCode).emit('gameEnded', {
                reason: 'allImpostorsFound',
                gameState: game.getGameState()
              });
            }, 3000);
          }
        }, 500);
      } else if (removeResult.shouldProcessDecision && removeResult.decisionResult) {
        setTimeout(() => {
          if (removeResult.decisionResult.majorityWantsVote) {
            game.startVoting();
            io.to(gameCode).emit('votingStarted', {
              decisionResult: removeResult.decisionResult,
              gameState: game.getGameState()
            });
          } else {
            game.nextRound(true);
            io.to(gameCode).emit('nextRoundStarted', {
              gameState: game.getGameState()
            });
          }
        }, 500);
      } else {
        // Sprawdź czy gra się zakończyła z powodu zbyt małej liczby graczy
        if (game.gameEnded && game.players.size < 3) {
          io.to(gameCode).emit('gameEnded', {
            reason: 'notEnoughPlayers',
            gameState: game.getGameState()
          });
        } else {
          // Zwykłe powiadomienie o opuszczeniu gracza
          io.to(gameCode).emit('playerLeft', {
            playerId: socket.id,
            gameState: game.getGameState()
          });
        }
      }
      
      console.log(`Gracz wyszedł: ${socket.id} z gry ${gameCode}`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});

