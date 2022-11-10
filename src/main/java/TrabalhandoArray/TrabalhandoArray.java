package TrabalhandoArray;

import javax.swing.*;

public class TrabalhandoArray {

    public static void main(String[] args) {
        //declarando o array de paises
        String [] paises =new String[4];
        int[]  numeros = new int[10];
        //abastecendo o array de paises
        for (int i = 0; i < paises.length; i++){
            paises[i] = JOptionPane.showInputDialog("Informe um pais:");
        }
        //listando o array de paises
        for (String listaPaises : paises) {
            System.out.println(listaPaises);
        }
        //abastecendo o array de numeros
        for (int i = 0; i < 10 ; i++) {
            numeros[i] = Integer.parseInt (JOptionPane.showInputDialog("informe um numero"));
        }
        //listando o array de numeros
        for (Integer listaNumeros : numeros) {
            System.out.println(listaNumeros);
        }
        int novoValor = 11;
        numeros[0] = novoValor;

        System.out.println(numeros[0]);
        
        
        
        

    }








}
